import * as vscode from 'vscode';
import { Octokit } from '@octokit/rest';

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: string;
  body?: string;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  labels: GitHubLabel[];
  milestone?: GitHubMilestone;
  assignees: GitHubUser[];
  reporter: GitHubUser;
  comments: number;
}

export interface GitHubMilestone {
  number: number;
  title: string;
  description?: string;
  state: string;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
  dueOn?: string;
  openIssues: number;
  closedIssues: number;
}

export interface GitHubLabel {
  id: number;
  name: string;
  color: string;
  description?: string;
}

export interface GitHubUser {
  login: string;
  htmlUrl: string;
  avatarUrl: string;
}

export interface GitHubRepository {
  owner: string;
  name: string;
  htmlUrl: string;
  description?: string;
}

export type OctokitFactory = () => Octokit;

export class GitHubService {
  private octokit: Octokit;
  private octokitFactory: OctokitFactory;

  constructor(token: string, octokitFactory?: OctokitFactory) {
    this.octokitFactory = octokitFactory || (() => new Octokit({ auth: token }));
    this.octokit = this.octokitFactory();
  }

  // For testing - replace the octokit instance
  setOctokit(octokit: Octokit): void {
    this.octokit = octokit;
  }

  // For testing - replace the factory
  setOctokitFactory(factory: OctokitFactory): void {
    this.octokitFactory = factory;
  }

  async authenticate(): Promise<boolean> {
    try {
      const { data } = await this.octokit.users.getAuthenticated();
      return !!data;
    } catch {
      return false;
    }
  }

  async getRepos(owner?: string): Promise<GitHubRepository[]> {
    if (owner) {
      return this.getOrgRepos(owner);
    }
    const { data } = await this.octokit.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: 100,
    });
    return data.map((repo) => ({
      owner: repo.owner.login,
      name: repo.name,
      htmlUrl: repo.html_url,
      description: repo.description || undefined,
    }));
  }

  async getOrgRepos(owner: string): Promise<GitHubRepository[]> {
    const { data } = await this.octokit.repos.listForOrg({ org: owner, per_page: 100 });
    return data.map((repo) => ({
      owner: owner,
      name: repo.name,
      htmlUrl: repo.html_url,
      description: repo.description || undefined,
    }));
  }

  async getMilestones(
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'all'
  ): Promise<GitHubMilestone[]> {
    const { data } = await this.octokit.issues.listMilestones({
      owner,
      repo,
      state,
      sort: 'due_on',
      direction: 'asc',
      per_page: 100,
    });

    return data.map((m) => {
      const openCount = m.open_issues ?? 0;
      const totalCount = openCount + m.closed_issues;
      return {
        number: m.number,
        title: m.title,
        description: m.description || undefined,
        state: m.state as 'open' | 'closed',
        htmlUrl: m.html_url,
        createdAt: m.created_at,
        updatedAt: m.updated_at,
        dueOn: m.due_on || undefined,
        openIssues: openCount,
        closedIssues: m.closed_issues,
      };
    });
  }

  async getIssues(
    owner: string,
    repo: string,
    milestoneNumber?: number,
    state: 'open' | 'closed' | 'all' = 'all'
  ): Promise<GitHubIssue[]> {
    let filterParam: string | undefined;
    if (milestoneNumber) {
      filterParam = `milestone:${milestoneNumber}`;
    }

    const { data } = await this.octokit.issues.listForRepo({
      owner,
      repo,
      state,
      sort: 'created',
      direction: 'desc',
      per_page: 100,
      filter: filterParam,
    });

    return data.map((issue) => ({
      id: issue.id,
      number: issue.number,
      title: issue.title,
      state: issue.state,
      body: issue.body || undefined,
      htmlUrl: issue.html_url,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      closedAt: issue.closed_at || undefined,
      labels: issue.labels.map((l) => ({
        id: typeof l === 'object' ? (l as any).id || 0 : 0,
        name: typeof l === 'object' ? (l as any).name || '' : l,
        color: typeof l === 'object' ? (l as any).color || '000000' : '000000',
        description: typeof l === 'object' ? (l as any).description || undefined : undefined,
      })),
      milestone: issue.milestone
        ? {
            number: issue.milestone.number,
            title: issue.milestone.title,
            state: issue.milestone.state as 'open' | 'closed',
            htmlUrl: issue.milestone.html_url,
            createdAt: issue.milestone.created_at,
            updatedAt: issue.milestone.updated_at,
            dueOn: issue.milestone.due_on || undefined,
            openIssues: 0,
            closedIssues: 0,
          }
        : undefined,
      assignees: (issue.assignees || []).map((u) => ({
        login: u.login,
        htmlUrl: u.html_url,
        avatarUrl: u.avatar_url,
      })),
      reporter: {
        login: issue.user?.login || '',
        htmlUrl: issue.user?.html_url || '',
        avatarUrl: issue.user?.avatar_url || '',
      },
      comments: issue.comments || 0,
    }));
  }

  async getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue> {
    const { data } = await this.octokit.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    });

    return {
      id: data.id,
      number: data.number,
      title: data.title,
      state: data.state,
      body: data.body || undefined,
      htmlUrl: data.html_url,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      closedAt: data.closed_at || undefined,
      labels: data.labels.map((l) => ({
        id: typeof l === 'object' ? (l as any).id || 0 : 0,
        name: typeof l === 'object' ? (l as any).name || '' : l,
        color: typeof l === 'object' ? (l as any).color || '000000' : '000000',
        description: typeof l === 'object' ? (l as any).description || undefined : undefined,
      })),
      milestone: data.milestone
        ? {
            number: data.milestone.number,
            title: data.milestone.title,
            state: data.milestone.state as 'open' | 'closed',
            htmlUrl: data.milestone.html_url,
            createdAt: data.milestone.created_at,
            updatedAt: data.milestone.updated_at,
            dueOn: data.milestone.due_on || undefined,
            openIssues: 0,
            closedIssues: 0,
          }
        : undefined,
      assignees: (data.assignees || []).map((u) => ({
        login: u.login,
        htmlUrl: u.html_url,
        avatarUrl: u.avatar_url,
      })),
      reporter: {
        login: data.user?.login || '',
        htmlUrl: data.user?.html_url || '',
        avatarUrl: data.user?.avatar_url || '',
      },
      comments: data.comments || 0,
    };
  }

}
