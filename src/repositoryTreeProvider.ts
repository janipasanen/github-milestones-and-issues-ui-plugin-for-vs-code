import * as vscode from 'vscode';
import { GitHubService, GitHubRepository } from './github';

export class RepositoryTreeItem extends vscode.TreeItem {
  constructor(
    public readonly repo: GitHubRepository,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    private github: GitHubService
  ) {
    super(repo.name, collapsibleState);
    this.id = `${repo.owner}/${repo.name}`;
    this.tooltip = repo.description || repo.name;
    this.description = repo.description || '';
    this.command = {
      command: 'github-milestones.openRepo',
      title: 'Open Repository',
      arguments: [repo],
    };
  }
}

export class RepositoryTreeProvider implements vscode.TreeDataProvider<RepositoryTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<RepositoryTreeItem>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private github: GitHubService) {}

  refresh(): void {
    (this._onDidChangeTreeData as any).fire();
  }

  getTreeItem(element: RepositoryTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: RepositoryTreeItem): Promise<RepositoryTreeItem[]> {
    if (element) {
      return [];
    }

    const config = vscode.workspace.getConfiguration('github-milestones');
    const owner = config.get<string>('defaultOwner');

    let repos: GitHubRepository[];
    try {
      repos = owner ? await this.github.getRepos(owner) : await this.github.getRepos();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to load repositories: ${(error as Error).message}`);
      return [];
    }

    return repos.map(
      (repo) =>
        new RepositoryTreeItem(
          repo,
          vscode.TreeItemCollapsibleState.Collapsed,
          this.github
        )
    );
  }

  async getRepositoryChildren(
    owner: string,
    repo: string,
    element?: RepositoryTreeItem
  ): Promise<RepositoryTreeItem[]> {
    if (element) {
      return [];
    }

    const items: RepositoryTreeItem[] = [];

    const milestoneItem = new RepositoryTreeItem(
      { owner, name: `${repo} (Milestones)`, htmlUrl: '' } as GitHubRepository,
      vscode.TreeItemCollapsibleState.Collapsed,
      this.github
    );
    milestoneItem.label = 'Milestones';
    milestoneItem.id = `${owner}/${repo}/milestones`;
    milestoneItem.iconPath = new vscode.ThemeIcon('milestone');
    milestoneItem.contextValue = 'milestonesFolder';

    const issuesItem = new RepositoryTreeItem(
      { owner, name: `${repo} (Issues)`, htmlUrl: '' } as GitHubRepository,
      vscode.TreeItemCollapsibleState.Collapsed,
      this.github
    );
    issuesItem.label = 'Issues';
    issuesItem.id = `${owner}/${repo}/issues`;
    issuesItem.iconPath = new vscode.ThemeIcon('issue-opened');
    issuesItem.contextValue = 'issuesFolder';

    return [milestoneItem, issuesItem];
  }
}
