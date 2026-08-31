import * as vscode from 'vscode';
import { GitHubService, GitHubMilestone } from './github';
import { RepositoryTreeProvider } from './repositoryTreeProvider';

export class MilestoneTreeItem extends vscode.TreeItem {
  constructor(
    public readonly milestone: GitHubMilestone,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    private github: GitHubService,
    private owner: string,
    private repo: string
  ) {
    super(milestone.title, collapsibleState);
    this.id = `${this.owner}/${this.repo}/milestone/${milestone.number}`;
    this.tooltip = `${milestone.title}\n${milestone.description || ''}`;
    this.description = `${milestone.openIssues} open · ${milestone.closedIssues} closed`;

    if (milestone.state === 'open') {
      this.iconPath = new vscode.ThemeIcon('milestone', new vscode.ThemeColor('charts.green'));
    } else {
      this.iconPath = new vscode.ThemeIcon('milestone', new vscode.ThemeColor('charts.red'));
    }

    this.command = {
      command: 'github-milestones.openMilestoneDetail',
      title: 'Open Milestone Detail',
      arguments: [this.owner, this.repo, milestone],
    };

    this.contextValue = 'milestone';
  }
}

export class MilestoneTreeProvider implements vscode.TreeDataProvider<MilestoneTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<MilestoneTreeItem>();
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

  getTreeItem(element: MilestoneTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: MilestoneTreeItem): Promise<MilestoneTreeItem[]> {
    if (!this.selectedOwner || !this.selectedRepo) {
      return [];
    }

    if (element) {
      return this.getMilestoneChildren(this.selectedOwner, this.selectedRepo, (element as any).milestone?.number, element);
    }

    try {
      const milestones = await this.github.getMilestones(
        this.selectedOwner,
        this.selectedRepo,
        'all'
      );

      return milestones.map(
        (m) =>
          new MilestoneTreeItem(
            m,
            vscode.TreeItemCollapsibleState.Collapsed,
            this.github,
            this.selectedOwner!,
            this.selectedRepo!
          )
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to load milestones: ${(error as Error).message}`);
      return [];
    }
  }

  async getMilestoneChildren(
    owner: string,
    repo: string,
    milestoneNumber: number,
    element?: MilestoneTreeItem
  ): Promise<MilestoneTreeItem[]> {
    if (element) {
      return [];
    }

    try {
      const issues = await this.github.getIssues(owner, repo, milestoneNumber, 'all');

      return issues.map(
        (issue) =>
          new MilestoneTreeItem(
            {
              number: 0,
              title: `#${issue.number}: ${issue.title}`,
              description: issue.body || '',
              state: issue.state as 'open' | 'closed',
              htmlUrl: issue.htmlUrl,
              createdAt: issue.createdAt,
              updatedAt: issue.updatedAt,
              openIssues: 0,
              closedIssues: 0,
            } as GitHubMilestone,
            vscode.TreeItemCollapsibleState.None,
            this.github,
            owner,
            repo
          )
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to load issues: ${(error as Error).message}`);
      return [];
    }
  }
}
