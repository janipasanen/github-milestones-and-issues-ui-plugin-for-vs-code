import * as vscode from 'vscode';
import { GitHubService, GitHubIssue, GitHubMilestone, GitHubRepository } from './github';
import { RepositoryTreeProvider } from './repositoryTreeProvider';
import { MilestoneTreeProvider } from './milestoneTreeProvider';
import { IssueTreeProvider } from './issueTreeProvider';
import { IssueDetailProvider } from './issueDetailProvider';
import { MilestoneDetailProvider } from './milestoneDetailProvider';

let githubService: GitHubService | null = null;
let repositoryProvider: RepositoryTreeProvider;
let milestoneProvider: MilestoneTreeProvider;
let issueProvider: IssueTreeProvider;
let selectedOwner: string | undefined;
let selectedRepo: string | undefined;
let selectedMilestoneNumber: number | undefined;

export function activate(context: vscode.ExtensionContext) {
  // Initialize providers
  repositoryProvider = new RepositoryTreeProvider(new GitHubService(''));
  milestoneProvider = new MilestoneTreeProvider(new GitHubService(''));
  issueProvider = new IssueTreeProvider(new GitHubService(''));

  // Register tree views
  const repoView = vscode.window.createTreeView('github-milestones.repositories', {
    treeDataProvider: repositoryProvider,
    showCollapseAll: false,
  });
  context.subscriptions.push(repoView);

  const milestoneView = vscode.window.createTreeView('github-milestones.milestones', {
    treeDataProvider: milestoneProvider,
    showCollapseAll: false,
  });
  context.subscriptions.push(milestoneView);

  const issueView = vscode.window.createTreeView('github-milestones.issues', {
    treeDataProvider: issueProvider,
    showCollapseAll: false,
  });
  context.subscriptions.push(issueView);

  // Sign in command
  const signIn = vscode.commands.registerCommand('github-milestones.signin', async () => {
    const token = await vscode.window.showInputBox({
      prompt: 'Enter your GitHub Personal Access Token',
      placeHolder: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      password: true,
      ignoreFocusOut: true,
    });

    if (!token) {
      return;
    }

    try {
      githubService = new GitHubService(token);
      const authed = await githubService.authenticate();
      if (authed) {
        vscode.window.showInformationMessage('Successfully signed in to GitHub!');
        updateTreeProviders();
      } else {
        vscode.window.showErrorMessage('Authentication failed. Please check your token.');
        githubService = null;
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Authentication failed: ${(error as Error).message}`);
      githubService = null;
    }
  });
  context.subscriptions.push(signIn);

  // Sign out command
  const signOut = vscode.commands.registerCommand('github-milestones.signout', async () => {
    githubService = null;
    selectedOwner = undefined;
    selectedRepo = undefined;
    selectedMilestoneNumber = undefined;
    updateTreeProviders();
    vscode.window.showInformationMessage('Signed out of GitHub.');
  });
  context.subscriptions.push(signOut);

  // Refresh command
  const refresh = vscode.commands.registerCommand('github-milestones.refresh', () => {
    if (selectedOwner && selectedRepo) {
      milestoneProvider.setSelection(selectedOwner, selectedRepo, selectedMilestoneNumber);
      issueProvider.setSelection(selectedOwner, selectedRepo, selectedMilestoneNumber);
    }
    if (githubService) {
      repositoryProvider.refresh();
    }
  });
  context.subscriptions.push(refresh);

  // Open repository command
  const openRepo = vscode.commands.registerCommand(
    'github-milestones.openRepo',
    async (repo: GitHubRepository) => {
      selectedOwner = repo.owner;
      selectedRepo = repo.name;
      selectedMilestoneNumber = undefined;

      milestoneProvider.setSelection(selectedOwner!, selectedRepo!);
      issueProvider.setSelection(selectedOwner!, selectedRepo!);

      vscode.window.showInformationMessage(
        `Selected repository: ${repo.owner}/${repo.name}`
      );
    }
  );
  context.subscriptions.push(openRepo);

  // Open milestone detail in webview panel
  const openMilestone = vscode.commands.registerCommand(
    'github-milestones.openMilestoneDetail',
    async (owner: string, repo: string, milestone: GitHubMilestone) => {
      selectedMilestoneNumber = milestone.number;

      milestoneProvider.setSelection(owner, repo, milestone.number);
      issueProvider.setSelection(owner, repo, milestone.number);

      const panel = vscode.window.createWebviewPanel(
        'github-milestones.milestoneDetail',
        `Milestone: ${milestone.title}`,
        vscode.ViewColumn.Two,
        { enableScripts: true }
      );

      panel.webview.html = getMilestoneDetailHtml(milestone, owner, repo);

      panel.onDidReceiveMessage((message) => {
        if (message.type === 'openInBrowser') {
          vscode.env.openExternal(vscode.Uri.parse(message.url));
        }
      });

      // Track panel for disposal
      panel.onDidDispose(() => {}, null, context.subscriptions);

      vscode.window.showInformationMessage(
        `Milestone: ${milestone.title} (${owner}/${repo})`
      );
    }
  );
  context.subscriptions.push(openMilestone);

  // Open issue detail in webview panel
  const openIssue = vscode.commands.registerCommand(
    'github-milestones.openIssueDetail',
    async (owner: string, repo: string, issue: GitHubIssue) => {
      issueProvider.setSelection(owner, repo, selectedMilestoneNumber);

      const panel = vscode.window.createWebviewPanel(
        'github-milestones.issueDetail',
        `#${issue.number}: ${issue.title}`,
        vscode.ViewColumn.Two,
        { enableScripts: true }
      );

      panel.webview.html = getIssueDetailHtml(issue, owner, repo);

      panel.onDidReceiveMessage((message) => {
        if (message.type === 'openInBrowser') {
          vscode.env.openExternal(vscode.Uri.parse(message.url));
        }
      });

      panel.onDidDispose(() => {}, null, context.subscriptions);
    }
  );
  context.subscriptions.push(openIssue);

  // Open issue from tree context menu - open in browser
  const openIssueFromTree = vscode.commands.registerCommand(
    'github-milestones.openIssue',
    async (issue: GitHubIssue) => {
      if (issue.htmlUrl) {
        vscode.env.openExternal(vscode.Uri.parse(issue.htmlUrl));
      }
    }
  );
  context.subscriptions.push(openIssueFromTree);

  // Open milestone from tree context menu - open in browser
  const openMilestoneFromTree = vscode.commands.registerCommand(
    'github-milestones.openMilestone',
    async (milestone: GitHubMilestone) => {
      if (milestone.htmlUrl) {
        vscode.env.openExternal(vscode.Uri.parse(milestone.htmlUrl));
      }
    }
  );
  context.subscriptions.push(openMilestoneFromTree);

  vscode.window.showInformationMessage('GitHub Milestones & Issues extension activated!');
}

function getIssueDetailHtml(issue: GitHubIssue, owner: string, repo: string): string {
  const labelsHtml = issue.labels
    .map(
      (l) =>
        `<span style="display:inline-block;padding:2px 8px;margin:2px;border-radius:12px;background-color:#${l.color};color:#fff;font-size:12px;">${l.name}</span>`
    )
    .join(' ');

  const assigneesHtml = issue.assignees
    .map((a) => `@${a.login}`)
    .join(', ') || 'Unassigned';

  const stateColor = issue.state === 'open' ? '#3fb950' : '#f85149';
  const stateText = issue.state === 'open' ? 'Open' : 'Closed';

  const bodyHtml = issue.body ? renderMarkdown(issue.body) : '<p style="color:#888;">No description provided.</p>';

  return `<!DOCTYPE html>
<html>
<head><style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; padding: 16px; color: var(--vscode-foreground); background-color: var(--vscode-editor-background); font-size: 14px; line-height: 1.6; }
  .header { border-bottom: 1px solid var(--vscode-panel-borderSideColor); padding-bottom: 12px; margin-bottom: 16px; }
  .title { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
  .meta { display: flex; align-items: center; gap: 12px; font-size: 12px; color: var(--vscode-descriptionForeground); flex-wrap: wrap; }
  .state-badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; background-color: ${stateColor}; color: white; }
  .info-grid { display: grid; grid-template-columns: 140px 1fr; gap: 8px; margin: 12px 0; font-size: 13px; }
  .info-label { color: var(--vscode-descriptionForeground); font-weight: 600; }
  .info-value { color: var(--vscode-foreground); }
  .content { border-top: 1px solid var(--vscode-panel-borderSideColor); padding-top: 16px; margin-top: 12px; }
  button { background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 6px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; }
  button:hover { background-color: var(--vscode-button-hoverBackground); }
  .actions { display: flex; gap: 8px; margin-bottom: 16px; }
</style></head>
<body>
  <div class="header">
    <div class="title">${escapeHtml(issue.title)}</div>
    <div class="meta">
      <span class="state-badge">${stateText}</span>
      <span>opened ${formatDate(issue.createdAt)} by ${issue.reporter.login}</span>
      ${issue.updatedAt !== issue.createdAt ? `<span>updated ${formatDate(issue.updatedAt)}</span>` : ''}
      ${issue.closedAt ? `<span>closed ${formatDate(issue.closedAt)}</span>` : ''}
    </div>
  </div>
  <div class="actions"><button onclick="postMessage({type:'openInBrowser', url:'${issue.htmlUrl}'})">Open on GitHub</button></div>
  <div class="info-grid">
    <div class="info-label">Labels</div>
    <div class="info-value">${labelsHtml || '<span style="color:var(--vscode-descriptionForeground)">None</span>'}</div>
    <div class="info-label">Assignees</div>
    <div class="info-value">${assigneesHtml}</div>
    ${issue.milestone ? `<div class="info-label">Milestone</div><div class="info-value"><a href="https://github.com/${owner}/${repo}/milestone/${issue.milestone.number}" target="_blank" style="color:var(--vscode-textLink-foreground)">${issue.milestone.title}</a></div>` : ''}
    <div class="info-label">Comments</div>
    <div class="info-value">${issue.comments}</div>
    <div class="info-label">Repository</div>
    <div class="info-value"><a href="https://github.com/${owner}/${repo}" target="_blank" style="color:var(--vscode-textLink-foreground)">${owner}/${repo}</a></div>
  </div>
  <div class="content"><h3 style="margin:0 0 8px 0;font-size:16px;font-weight:600;">Description</h3>${bodyHtml}</div>
  <script>const vscode=acquireVsCodeApi();</script>
</body></html>`;
}

function getMilestoneDetailHtml(milestone: GitHubMilestone, owner: string, repo: string): string {
  const stateColor = milestone.state === 'open' ? '#3fb950' : '#f85149';
  const stateText = milestone.state === 'open' ? 'Open' : 'Closed';

  const dueOnHtml = milestone.dueOn
    ? `<div class="info-grid"><div class="info-label">Due Date</div><div class="info-value">${new Date(milestone.dueOn).toLocaleDateString()}</div></div>`
    : '';

  const bodyHtml = milestone.description ? renderMarkdown(milestone.description) : '<p style="color:#888;">No description provided.</p>';

  return `<!DOCTYPE html>
<html>
<head><style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; padding: 16px; color: var(--vscode-foreground); background-color: var(--vscode-editor-background); font-size: 14px; line-height: 1.6; }
  .header { border-bottom: 1px solid var(--vscode-panel-borderSideColor); padding-bottom: 12px; margin-bottom: 16px; }
  .title { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
  .meta { display: flex; align-items: center; gap: 12px; font-size: 12px; color: var(--vscode-descriptionForeground); flex-wrap: wrap; }
  .state-badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; background-color: ${stateColor}; color: white; }
  .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 12px 0; }
  .stat-card { background-color: var(--vscode-textBlockQuote-background); border-radius: 6px; padding: 12px; text-align: center; }
  .stat-number { font-size: 24px; font-weight: 700; color: var(--vscode-foreground); }
  .stat-label { font-size: 11px; color: var(--vscode-descriptionForeground); text-transform: uppercase; margin-top: 2px; }
  .info-grid { display: grid; grid-template-columns: 140px 1fr; gap: 8px; margin: 12px 0; font-size: 13px; }
  .info-label { color: var(--vscode-descriptionForeground); font-weight: 600; }
  .info-value { color: var(--vscode-foreground); }
  .content { border-top: 1px solid var(--vscode-panel-borderSideColor); padding-top: 16px; margin-top: 12px; }
  button { background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 6px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; }
  button:hover { background-color: var(--vscode-button-hoverBackground); }
  .actions { display: flex; gap: 8px; margin-bottom: 16px; }
</style></head>
<body>
  <div class="header">
    <div class="title">${escapeHtml(milestone.title)}</div>
    <div class="meta">
      <span class="state-badge">${stateText}</span>
      <span>Milestone #${milestone.number}</span>
    </div>
  </div>
  <div class="actions"><button onclick="postMessage({type:'openInBrowser', url:'${milestone.htmlUrl}'})">Open on GitHub</button></div>
  <div class="stats-grid">
    <div class="stat-card"><div class="stat-number">${milestone.openIssues}</div><div class="stat-label">Open</div></div>
    <div class="stat-card"><div class="stat-number">${milestone.closedIssues}</div><div class="stat-label">Closed</div></div>
    <div class="stat-card"><div class="stat-number">${milestone.openIssues + milestone.closedIssues}</div><div class="stat-label">Total</div></div>
  </div>
  <div class="info-grid"><div class="info-label">Created</div><div class="info-value">${formatDate(milestone.createdAt)}</div></div>
  <div class="info-grid"><div class="info-label">Last Updated</div><div class="info-value">${formatDate(milestone.updatedAt)}</div></div>
  ${dueOnHtml}
  <div class="info-grid"><div class="info-label">Repository</div><div class="info-value"><a href="https://github.com/${owner}/${repo}" target="_blank" style="color:var(--vscode-textLink-foreground)">${owner}/${repo}</a></div></div>
  <div class="content"><h3 style="margin:0 0 8px 0;font-size:16px;font-weight:600;">Description</h3>${bodyHtml}</div>
  <script>const vscode=acquireVsCodeApi();</script>
</body></html>`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderMarkdown(text: string): string {
  let html = escapeHtml(text);
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color:var(--vscode-textLink-foreground)">$1</a>');
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%" />');
  html = html.replace(/\[x\]/g, '<input type="checkbox" checked disabled>');
  html = html.replace(/\[ \]/g, '<input type="checkbox" disabled>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  html = html.replace(/\n/g, '<br>');
  html = html.replace(/<br><br>/g, '</p><p>');
  return `<p>${html}</p>`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

function updateTreeProviders(): void {
  const service = githubService;
  if (service) {
    repositoryProvider = new RepositoryTreeProvider(service);
    milestoneProvider = new MilestoneTreeProvider(service);
    issueProvider = new IssueTreeProvider(service);

    if (selectedOwner && selectedRepo) {
      milestoneProvider.setSelection(selectedOwner, selectedRepo, selectedMilestoneNumber);
      issueProvider.setSelection(selectedOwner, selectedRepo, selectedMilestoneNumber);
    }

    repositoryProvider.refresh();
  }
}

function updateTreeViews(): void {
  repositoryProvider.refresh();
}

export function deactivate() {}
