import * as vscode from 'vscode';
import { GitHubIssue, GitHubMilestone, GitHubRepository } from './github';

export class IssueDetailProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'github-milestones.issueDetail';

  private view?: vscode.WebviewView;

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.onDidReceiveMessage((message: { type: string; url: string }) => {
      switch (message.type) {
        case 'openInBrowser':
          vscode.env.openExternal(vscode.Uri.parse(message.url));
          break;
      }
    });
  }

  show(issue: GitHubIssue, owner: string, repo: string): void {
    if (!this.view) {
      return;
    }

    this.view.webview.html = this.getHtml(issue, owner, repo);
    this.view.show(true);
  }

  private getHtml(issue: GitHubIssue, owner: string, repo: string): string {
    const labelsHtml = issue.labels
      .map(
        (l) =>
          `<span style="display:inline-block;padding:2px 8px;margin:2px;border-radius:12px;background-color:#${l.color};color:#fff;font-size:12px;">${l.name}</span>`
      )
      .join(' ');

    const assigneesHtml = issue.assignees
      .map((a) => `@${a.login}`)
      .join(', ') || 'Unassigned';

    const milestoneTitle = issue.milestone
      ? issue.milestone.title
      : 'None';

    const stateColor = issue.state === 'open' ? '#3fb950' : '#f85149';
    const stateText = issue.state === 'open' ? 'Open' : 'Closed';

    const bodyHtml = issue.body
      ? this.renderMarkdown(issue.body)
      : '<p style="color:#888;">No description provided.</p>';

    return `<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      padding: 16px;
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      font-size: 14px;
      line-height: 1.6;
    }
    .header {
      border-bottom: 1px solid var(--vscode-panel-borderSideColor);
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .title {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .meta {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      flex-wrap: wrap;
    }
    .state-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      background-color: ${stateColor};
      color: white;
    }
    .labels {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
      margin: 8px 0;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: 8px;
      margin: 12px 0;
      font-size: 13px;
    }
    .info-label {
      color: var(--vscode-descriptionForeground);
      font-weight: 600;
    }
    .info-value {
      color: var(--vscode-foreground);
    }
    .content {
      border-top: 1px solid var(--vscode-panel-borderSideColor);
      padding-top: 16px;
      margin-top: 12px;
    }
    button {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 6px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
    }
    button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
    .actions {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }
    pre, code {
      background-color: var(--vscode-textCodeBlock-background);
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">${this.escapeHtml(issue.title)}</div>
    <div class="meta">
      <span class="state-badge">${stateText}</span>
      <span>opened ${this.formatDate(issue.createdAt)} by ${issue.reporter.login}</span>
      ${issue.updatedAt !== issue.createdAt ? `<span>updated ${this.formatDate(issue.updatedAt)}</span>` : ''}
      ${issue.closedAt ? `<span>closed ${this.formatDate(issue.closedAt)}</span>` : ''}
    </div>
  </div>

  <div class="actions">
    <button onclick="postMessage({type:'openInBrowser', url:'${issue.htmlUrl}'})">Open on GitHub</button>
  </div>

  <div class="info-grid">
    <div class="info-label">Labels</div>
    <div class="info-value">${labelsHtml || '<span style="color:var(--vscode-descriptionForeground)">None</span>'}</div>

    <div class="info-label">Assignees</div>
    <div class="info-value">${assigneesHtml}</div>

    ${issue.milestone ? `
    <div class="info-label">Milestone</div>
    <div class="info-value"><a href="https://github.com/${owner}/${repo}/milestone/${issue.milestone.number}" target="_blank" style="color:var(--vscode-textLink-foreground)">${issue.milestone.title}</a></div>
    ` : ''}

    <div class="info-label">Comments</div>
    <div class="info-value">${issue.comments}</div>

    <div class="info-label">Repository</div>
    <div class="info-value"><a href="https://github.com/${owner}/${repo}" target="_blank" style="color:var(--vscode-textLink-foreground)">${owner}/${repo}</a></div>
  </div>

  <div class="content">
    <h3 style="margin:0 0 8px 0;font-size:16px;font-weight:600;">Description</h3>
    ${bodyHtml}
  </div>

  <script>
    const vscode = acquireVsCodeApi();
  </script>
</body>
</html>`;
  }

  private renderMarkdown(text: string): string {
    let html = this.escapeHtml(text);

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

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private formatDate(dateStr: string): string {
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
}
