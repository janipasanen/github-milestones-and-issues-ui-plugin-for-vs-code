import * as vscode from 'vscode';
import { GitHubIssue, GitHubMilestone, GitHubRepository } from './github';

export class MilestoneDetailProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'github-milestones.milestoneDetail';

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

  show(milestone: GitHubMilestone, owner: string, repo: string): void {
    if (!this.view) {
      return;
    }

    this.view.webview.html = this.getHtml(milestone, owner, repo);
    this.view.show(true);
  }

  private getHtml(milestone: GitHubMilestone, owner: string, repo: string): string {
    const stateColor = milestone.state === 'open' ? '#3fb950' : '#f85149';
    const stateText = milestone.state === 'open' ? 'Open' : 'Closed';

    const dueOnHtml = milestone.dueOn
      ? `<div class="info-grid">
          <div class="info-label">Due Date</div>
          <div class="info-value">${new Date(milestone.dueOn).toLocaleDateString()}</div>
        </div>`
      : '';

    const bodyHtml = milestone.description
      ? this.renderMarkdown(milestone.description)
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
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin: 12px 0;
    }
    .stat-card {
      background-color: var(--vscode-textBlockQuote-background);
      border-radius: 6px;
      padding: 12px;
      text-align: center;
    }
    .stat-number {
      font-size: 24px;
      font-weight: 700;
      color: var(--vscode-foreground);
    }
    .stat-label {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
      margin-top: 2px;
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
    <div class="title">${this.escapeHtml(milestone.title)}</div>
    <div class="meta">
      <span class="state-badge">${stateText}</span>
      <span>Milestone #${milestone.number}</span>
    </div>
  </div>

  <div class="actions">
    <button onclick="postMessage({type:'openInBrowser', url:'${milestone.htmlUrl}'})">Open on GitHub</button>
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-number">${milestone.openIssues}</div>
      <div class="stat-label">Open</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${milestone.closedIssues}</div>
      <div class="stat-label">Closed</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${milestone.openIssues + milestone.closedIssues}</div>
      <div class="stat-label">Total</div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-label">Created</div>
    <div class="info-value">${this.formatDate(milestone.createdAt)}</div>
  </div>

  <div class="info-grid">
    <div class="info-label">Last Updated</div>
    <div class="info-value">${this.formatDate(milestone.updatedAt)}</div>
  </div>

  ${dueOnHtml}

  <div class="info-grid">
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
