import * as vscode from 'vscode';
import { GitHubService, GitHubIssue, GitHubMilestone } from './github';

export class IssueTreeItem extends vscode.TreeItem {
  constructor(
    public readonly issue: GitHubIssue,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    private github: GitHubService,
    private owner: string,
    private repo: string
  ) {
    super(`#${issue.number}: ${issue.title}`, collapsibleState);
    this.id = `${this.owner}/${this.repo}/issue/${issue.number}`;
    this.tooltip = issue.title;
    this.description = `#${issue.number}`;

    if (issue.state === 'open') {
      this.iconPath = new vscode.ThemeIcon('issue-opened', new vscode.ThemeColor('charts.green'));
    } else {
      this.iconPath = new vscode.ThemeIcon('issue-closed', new vscode.ThemeColor('charts.red'));
    }

    this.command = {
      command: 'github-milestones.openIssueDetail',
      title: 'Open Issue Detail',
      arguments: [this.owner, this.repo, issue],
    };

    this.contextValue = 'issue';
  }
}

export class IssueTreeProvider implements vscode.TreeDataProvider<IssueTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<IssueTreeItem>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private selectedOwner: string | undefined;
  private selectedRepo: string | undefined;
  private selectedMilestoneNumber: number | undefined;

  constructor(private github: GitHubService) {}

  setSelection(owner: string, repo: string, milestoneNumber?: number): void {
    this.selectedOwner = owner;
    this.selectedRepo = repo;
    this.selectedMilestoneNumber = milestoneNumber;
    this.refresh();
  }

  refresh(): void {
    (this._onDidChangeTreeData as any).fire();
  }

  getTreeItem(element: IssueTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: IssueTreeItem): Promise<IssueTreeItem[]> {
    if (!this.selectedOwner || !this.selectedRepo) {
      return [];
    }

    if (element) {
      return [];
    }

    try {
      const issues = await this.github.getIssues(
        this.selectedOwner,
        this.selectedRepo,
        this.selectedMilestoneNumber,
        'all'
      );

      return issues.map(
        (issue) =>
          new IssueTreeItem(
            issue,
            vscode.TreeItemCollapsibleState.None,
            this.github,
            this.selectedOwner!,
            this.selectedRepo!
          )
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to load issues: ${(error as Error).message}`);
      return [];
    }
  }
}
