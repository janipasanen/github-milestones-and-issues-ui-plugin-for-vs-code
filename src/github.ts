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

  async searchRepositories(query: string, perPage: number = 30): Promise<GitHubRepository[]> {
    const { data } = await this.octokit.search.repos({
      q: query,
      per_page: perPage,
    });

    return data.items.map((repo: any) => ({
      owner: repo.owner.login,
      name: repo.name,
      htmlUrl: repo.html_url,
      description: repo.description || undefined,
    }));
  }

  async searchIssuesAndMilestones(
    query: string,
    perPage: number = 30
  ): Promise<Array<{ type: 'issue' | 'milestone'; owner: string; repo: string; item: GitHubIssue | GitHubMilestone }>> {
    const results: Array<{ type: 'issue' | 'milestone'; owner: string; repo: string; item: GitHubIssue | GitHubMilestone }> = [];

    // Search issues
    const issuesResult = await this.octokit.search.issuesAndPullRequests({
      q: query,
      per_page: perPage,
    });

    for (const issue of issuesResult.data.items) {
      const parts = (issue as any).repository_url.split('/');
      const owner = parts[parts.length - 2] || '';
      const repo = parts[parts.length - 1] || '';

      results.push({
        type: 'issue',
        owner,
        repo,
        item: {
          id: issue.id,
          number: issue.number,
          title: issue.title,
          state: issue.state,
          body: issue.body || undefined,
          htmlUrl: issue.html_url,
          createdAt: issue.created_at,
          updatedAt: issue.updated_at,
          closedAt: issue.closed_at || undefined,
          labels: (issue.labels || []).map((l: any) => ({
            id: l.id || 0,
            name: l.name || '',
            color: l.color || '000000',
            description: l.description || undefined,
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
          assignees: (issue.assignees || []).map((u: any) => ({
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
        } as GitHubIssue,
      });
    }

    // Search milestones
    const milestonesResult = await this.octokit.search.issuesAndPullRequests({
      q: `${query} type:milestone`,
      per_page: perPage,
    });

    for (const milestone of milestonesResult.data.items) {
      const parts = (milestone as any).repository_url.split('/');
      const owner = parts[parts.length - 2] || '';
      const repo = parts[parts.length - 1] || '';

      results.push({
        type: 'milestone',
        owner,
        repo,
        item: {
          number: milestone.number,
          title: milestone.title,
          description: (milestone as any).body || undefined,
          state: milestone.state as 'open' | 'closed',
          htmlUrl: milestone.html_url,
          createdAt: milestone.created_at,
          updatedAt: milestone.updated_at,
          dueOn: (milestone as any).due_on || undefined,
          openIssues: 0,
          closedIssues: 0,
        } as GitHubMilestone,
      });
    }

    return results;
  }

  async createIssue(
    owner: string,
    repo: string,
    title: string,
    body: string,
    milestoneNumber?: number,
    labels?: string[]
  ): Promise<GitHubIssue> {
    const { data } = await this.octokit.issues.create({
      owner,
      repo,
      title,
      body,
      milestone: milestoneNumber,
      labels: labels,
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

  async updateIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    updates: {
      title?: string;
      body?: string;
      state?: 'open' | 'closed';
      labels?: string[];
      assignees?: string[];
      milestone?: number;
    }
  ): Promise<GitHubIssue> {
    const { data } = await this.octokit.issues.update({
      owner,
      repo,
      issue_number: issueNumber,
      ...updates,
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

  async updateMilestone(
    owner: string,
    repo: string,
    milestoneNumber: number,
    updates: {
      title?: string;
      description?: string;
      state?: 'open' | 'closed';
      dueOn?: string;
      clearDueOn?: boolean;
    }
  ): Promise<GitHubMilestone> {
    const { data } = await this.octokit.issues.updateMilestone({
      owner,
      repo,
      milestone_number: milestoneNumber,
      ...updates,
    });

    return {
      number: data.number,
      title: data.title,
      description: data.description || undefined,
      state: data.state as 'open' | 'closed',
      htmlUrl: data.html_url,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      dueOn: data.due_on || undefined,
      openIssues: data.open_issues ?? 0,
      closedIssues: data.closed_issues,
    };
  }

  async getComments(owner: string, repo: string, issueNumber: number): Promise<Array<{ id: number; body: string; createdAt: string; user: { login: string; htmlUrl: string } }>> {
    const { data } = await this.octokit.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 100,
    });

    return data.map((comment: any) => ({
      id: comment.id,
      body: comment.body || '',
      createdAt: comment.created_at,
      user: {
        login: comment.user?.login || '',
        htmlUrl: comment.user?.html_url || '',
      },
    }));
  }

  async addComment(
    owner: string,
    repo: string,
    issueNumber: number,
    body: string
  ): Promise<{ id: number; body: string; createdAt: string; user: { login: string; htmlUrl: string } }> {
    const { data } = await this.octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    });

    return {
      id: data.id,
      body: data.body || '',
      createdAt: data.created_at,
      user: {
        login: data.user?.login || '',
        htmlUrl: data.user?.html_url || '',
      },
    };
  }

}
