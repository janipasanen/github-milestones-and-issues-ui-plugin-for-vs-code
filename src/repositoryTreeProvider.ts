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
    this.description = repo.description ? (repo.description.length > 50 ? repo.description.substring(0, 50) + '...' : repo.description) : '';
    
    this.iconPath = new vscode.ThemeIcon('repo');
    
    this.command = {
      command: 'github-milestones.openRepo',
      title: 'Open Repository',
      arguments: [repo],
    };
  }
}

export class RepositoryTreeProvider implements vscode.TreeDataProvider<RepositoryTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<RepositoryTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private loading = false;
  private repositories: GitHubRepository[] = [];
  private searchFilter = '';

  constructor(private github: GitHubService) {}

  refresh(): void {
    this.searchFilter = '';
    this._onDidChangeTreeData.fire(undefined);
  }

  setSearchFilter(filter: string): void {
    this.searchFilter = filter.toLowerCase();
    this._onDidChangeTreeData.fire(undefined);
  }

  setLoading(loading: boolean): void {
    this.loading = loading;
    if (loading) {
      this._onDidChangeTreeData.fire(undefined);
    }
  }

  getTreeItem(element: RepositoryTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: RepositoryTreeItem): Promise<RepositoryTreeItem[]> {
    if (this.loading) {
      return [this.getLoadingItem()];
    }

    if (element) {
      return [];
    }

    const config = vscode.workspace.getConfiguration('github-milestones');
    const owner = config.get<string>('defaultOwner');

    this.loading = true;
    this._onDidChangeTreeData.fire(undefined);

    try {
      this.repositories = owner ? await this.github.getRepos(owner) : await this.github.getRepos();

      let filteredRepos = [...this.repositories];

      if (this.searchFilter) {
        filteredRepos = filteredRepos.filter(repo => 
          repo.name.toLowerCase().includes(this.searchFilter) ||
          repo.owner.toLowerCase().includes(this.searchFilter) ||
          (repo.description && repo.description.toLowerCase().includes(this.searchFilter))
        );
      }

      const sortedRepos = filteredRepos.sort((a, b) => {
        if (a.name < b.name) return -1;
        if (a.name > b.name) return 1;
        return 0;
      });

      this.loading = false;
      this._onDidChangeTreeData.fire(undefined);

      return sortedRepos.map(
        (repo) =>
          new RepositoryTreeItem(
            repo,
            vscode.TreeItemCollapsibleState.Collapsed,
            this.github
          )
      );
    } catch (error) {
      this.loading = false;
      this._onDidChangeTreeData.fire(undefined);

      vscode.window.showErrorMessage(`Failed to load repositories: ${(error as Error).message}`);
      return [this.getErrorItem(error)];
    }
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

  private getLoadingItem(): RepositoryTreeItem {
    const item = new RepositoryTreeItem(
      { owner: '', name: 'Loading...', htmlUrl: '' } as GitHubRepository,
      vscode.TreeItemCollapsibleState.None,
      this.github
    );
    item.iconPath = new vscode.ThemeIcon('loading~spin');
    item.description = 'Fetching repositories...';
    item.tooltip = 'Please wait...';
    return item;
  }

  private getErrorItem(error: unknown): RepositoryTreeItem {
    const item = new RepositoryTreeItem(
      { owner: '', name: 'Error', htmlUrl: '' } as GitHubRepository,
      vscode.TreeItemCollapsibleState.None,
      this.github
    );
    item.iconPath = new vscode.ThemeIcon('error');
    item.description = 'Authentication required';
    item.tooltip = `Failed to load: ${(error as Error).message}. Try signing in again.`;
    return item;
  }
}
