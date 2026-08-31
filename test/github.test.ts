import { GitHubService } from '../src/github';
import { expect } from 'chai';

// Minimal mock of Octokit structure that GitHubService uses
class MockGitHubClient {
  authData = {
    login: 'testuser',
    html_url: 'https://github.com/testuser',
    avatar_url: 'https://avatars.githubusercontent.com/testuser',
  };

  repoList = [
    { id: 1, name: 'test-repo', owner: { login: 'testuser' }, html_url: 'https://github.com/testuser/test-repo', description: 'A test repository' },
    { id: 2, name: 'another-repo', owner: { login: 'testuser' }, html_url: 'https://github.com/testuser/another-repo', description: 'Another test repository' },
  ];

  milestoneList = [
    { number: 1, title: 'Milestone 1', description: 'First milestone', state: 'open', html_url: 'https://github.com/testuser/test-repo/milestone/1', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-15T00:00:00Z', due_on: '2024-06-01', open_issues: 3, closed_issues: 2 },
    { number: 2, title: 'Milestone 2', description: 'Second milestone', state: 'closed', html_url: 'https://github.com/testuser/test-repo/milestone/2', created_at: '2023-12-01T00:00:00Z', updated_at: '2024-01-10T00:00:00Z', due_on: '2024-03-01', open_issues: 0, closed_issues: 5 },
  ];

  issueList = [
    {
      id: 100, number: 1, title: 'Test Issue 1', state: 'open', body: 'This is a test issue with **bold** text.',
      html_url: 'https://github.com/testuser/test-repo/issues/1', created_at: '2024-01-10T00:00:00Z',
      updated_at: '2024-01-12T00:00:00Z', closed_at: null,
      labels: [{ id: 1, name: 'bug', color: 'd73a4a', description: 'Bug' }, { id: 2, name: 'enhancement', color: 'a2eeef', description: 'Enhancement' }],
      milestone: { number: 1, title: 'Milestone 1', state: 'open', html_url: 'https://github.com/testuser/test-repo/milestone/1', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-15T00:00:00Z', due_on: '2024-06-01' },
      assignees: [{ login: 'testuser', html_url: 'https://github.com/testuser', avatar_url: 'https://avatars.githubusercontent.com/testuser' }],
      user: { login: 'testuser', html_url: 'https://github.com/testuser', avatar_url: 'https://avatars.githubusercontent.com/testuser' },
      comments: 3,
    },
    {
      id: 101, number: 2, title: 'Test Issue 2', state: 'closed', body: 'Closed issue with no milestone.',
      html_url: 'https://github.com/testuser/test-repo/issues/2', created_at: '2024-01-05T00:00:00Z',
      updated_at: '2024-01-11T00:00:00Z', closed_at: '2024-01-11T00:00:00Z',
      labels: [{ id: 3, name: 'documentation', color: '0075ca', description: 'Documentation' }],
      milestone: null, assignees: [],
      user: { login: 'testuser', html_url: 'https://github.com/testuser', avatar_url: 'https://avatars.githubusercontent.com/testuser' },
      comments: 0,
    },
  ];

  // Methods that GitHubService calls on the Octokit instance
  users = { getAuthenticated: () => Promise.resolve({ data: this.authData }) };
  reposList = {
    listForAuthenticatedUser: () => Promise.resolve({ data: this.repoList }),
    listForOrg: () => Promise.resolve({ data: this.repoList }),
  };
  issuesList = {
    listMilestones: () => Promise.resolve({ data: this.milestoneList }),
    listForRepo: (params?: any) => {
      if (params?.filter) {
        const milestoneNum = parseInt(params.filter.replace('milestone:', ''));
        return Promise.resolve({ data: this.issueList.filter((i: any) => i.milestone?.number === milestoneNum) });
      }
      return Promise.resolve({ data: this.issueList });
    },
    get: (params: { issue_number: number }) => {
      const issue = this.issueList.find((i: any) => i.number === params.issue_number);
      if (issue) return Promise.resolve({ data: issue });
      return Promise.reject(new Error('Issue not found'));
    },
  };
}

describe('GitHubService', () => {
  let service: GitHubService;
  let mockClient: MockGitHubClient;

  function createServiceWithMock(mock: MockGitHubClient): GitHubService {
    // Create a fake Octokit that uses our mock data
    const fakeOctokit: any = {
      users: { getAuthenticated: () => ({ data: mock.authData }) },
      repos: {
        listForAuthenticatedUser: () => ({ data: mock.repoList }),
        listForOrg: () => ({ data: mock.repoList }),
      },
      issues: {
        listMilestones: (params?: any) => {
          if (params?.state && params.state !== 'all') {
            return { data: mock.milestoneList.filter((m: any) => m.state === params.state) };
          }
          return { data: mock.milestoneList };
        },
        listForRepo: (params?: any) => {
          if (params?.filter) {
            const milestoneNum = parseInt(params.filter.replace('milestone:', ''));
            return { data: mock.issueList.filter((i: any) => i.milestone?.number === milestoneNum) };
          }
          return { data: mock.issueList };
        },
        get: (params: { issue_number: number }) => {
          const issue = mock.issueList.find((i: any) => i.number === params.issue_number);
          if (issue) return { data: issue };
          throw new Error('Issue not found');
        },
      },
    };

    return new GitHubService('test-token', () => fakeOctokit);
  }

  beforeEach(() => {
    mockClient = new MockGitHubClient();
    service = createServiceWithMock(mockClient);
  });

  describe('authenticate', () => {
    it('should return true when authentication succeeds', async () => {
      const result = await service.authenticate();
      expect(result).to.be.true;
    });

    it('should return false when authentication fails', async () => {
      mockClient.authData = null as any;
      const result = await service.authenticate();
      expect(result).to.be.false;
    });
  });

  describe('getRepos', () => {
    it('should return list of repositories', async () => {
      const repos = await service.getRepos();
      expect(repos).to.have.lengthOf(2);
      expect(repos[0].name).to.equal('test-repo');
      expect(repos[0].owner).to.equal('testuser');
    });

    it('should return repository with correct properties', async () => {
      const repos = await service.getRepos();
      const repo = repos[0];
      expect(repo.name).to.equal('test-repo');
      expect(repo.owner).to.equal('testuser');
      expect(repo.htmlUrl).to.equal('https://github.com/testuser/test-repo');
      expect(repo.description).to.equal('A test repository');
    });
  });

  describe('getOrgRepos', () => {
    it('should return organization repositories', async () => {
      const repos = await service.getOrgRepos('testuser');
      expect(repos).to.have.lengthOf(2);
      expect(repos[0].owner).to.equal('testuser');
    });
  });

  describe('getMilestones', () => {
    it('should return list of milestones', async () => {
      const milestones = await service.getMilestones('testuser', 'test-repo');
      expect(milestones).to.have.lengthOf(2);
    });

    it('should return milestones with correct properties', async () => {
      const milestones = await service.getMilestones('testuser', 'test-repo');
      const milestone = milestones[0];
      expect(milestone.number).to.equal(1);
      expect(milestone.title).to.equal('Milestone 1');
      expect(milestone.description).to.equal('First milestone');
      expect(milestone.state).to.equal('open');
      expect(milestone.openIssues).to.equal(3);
      expect(milestone.closedIssues).to.equal(2);
    });

    it('should handle open and closed milestones correctly', async () => {
      const milestones = await service.getMilestones('testuser', 'test-repo', 'all');
      const openMilestones = milestones.filter((m) => m.state === 'open');
      const closedMilestones = milestones.filter((m) => m.state === 'closed');
      expect(openMilestones).to.have.lengthOf(1);
      expect(closedMilestones).to.have.lengthOf(1);
    });

    it('should filter by open state', async () => {
      const milestones = await service.getMilestones('testuser', 'test-repo', 'open');
      expect(milestones).to.have.lengthOf(1);
      expect(milestones[0].state).to.equal('open');
    });

    it('should filter by closed state', async () => {
      const milestones = await service.getMilestones('testuser', 'test-repo', 'closed');
      expect(milestones).to.have.lengthOf(1);
      expect(milestones[0].state).to.equal('closed');
    });

    it('should include due date when present', async () => {
      const milestones = await service.getMilestones('testuser', 'test-repo');
      expect(milestones[0].dueOn).to.equal('2024-06-01');
    });
  });

  describe('getIssues', () => {
    it('should return list of issues', async () => {
      const issues = await service.getIssues('testuser', 'test-repo');
      expect(issues).to.have.lengthOf(2);
    });

    it('should return issues with correct properties', async () => {
      const issues = await service.getIssues('testuser', 'test-repo');
      const issue = issues[0];
      expect(issue.id).to.equal(100);
      expect(issue.number).to.equal(1);
      expect(issue.title).to.equal('Test Issue 1');
      expect(issue.state).to.equal('open');
      expect(issue.body).to.equal('This is a test issue with **bold** text.');
    });

    it('should return issues with labels', async () => {
      const issues = await service.getIssues('testuser', 'test-repo');
      const issue = issues[0];
      expect(issue.labels).to.have.lengthOf(2);
      expect(issue.labels[0].name).to.equal('bug');
      expect(issue.labels[0].color).to.equal('d73a4a');
    });

    it('should return issues with assignees', async () => {
      const issues = await service.getIssues('testuser', 'test-repo');
      const issue = issues[0];
      expect(issue.assignees).to.have.lengthOf(1);
      expect(issue.assignees[0].login).to.equal('testuser');
    });

    it('should return issues with reporter info', async () => {
      const issues = await service.getIssues('testuser', 'test-repo');
      const issue = issues[0];
      expect(issue.reporter.login).to.equal('testuser');
      expect(issue.reporter.htmlUrl).to.equal('https://github.com/testuser');
    });

    it('should return issues with milestone info', async () => {
      const issues = await service.getIssues('testuser', 'test-repo');
      const issue = issues[0];
      expect(issue.milestone).to.exist;
      expect(issue.milestone?.title).to.equal('Milestone 1');
      expect(issue.milestone?.number).to.equal(1);
    });

    it('should return issues with comments count', async () => {
      const issues = await service.getIssues('testuser', 'test-repo');
      const issue = issues[0];
      expect(issue.comments).to.equal(3);
    });

    it('should filter issues by milestone', async () => {
      const issues = await service.getIssues('testuser', 'test-repo', 1);
      expect(issues).to.have.lengthOf(1);
      expect(issues[0].milestone?.number).to.equal(1);
    });

    it('should return empty array when filtering by non-existent milestone', async () => {
      const issues = await service.getIssues('testuser', 'test-repo', 999);
      expect(issues).to.have.lengthOf(0);
    });

    it('should handle issues without milestone', async () => {
      const issues = await service.getIssues('testuser', 'test-repo');
      const issueWithoutMilestone = issues.find((i) => i.number === 2);
      expect(issueWithoutMilestone?.milestone).to.be.undefined;
    });
  });

  describe('getIssue', () => {
    it('should return a single issue by number', async () => {
      const issue = await service.getIssue('testuser', 'test-repo', 1);
      expect(issue.number).to.equal(1);
      expect(issue.title).to.equal('Test Issue 1');
    });

    it('should return issue with all properties', async () => {
      const issue = await service.getIssue('testuser', 'test-repo', 1);
      expect(issue.labels).to.have.lengthOf(2);
      expect(issue.assignees).to.have.lengthOf(1);
      expect(issue.milestone).to.exist;
      expect(issue.comments).to.equal(3);
    });
  });
});
