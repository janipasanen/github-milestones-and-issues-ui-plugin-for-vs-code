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

  comments = [
    { id: 1, body: 'First comment', created_at: '2024-01-15T00:00:00Z', user: { login: 'user1', html_url: 'https://github.com/user1' } },
    { id: 2, body: 'Second comment', created_at: '2024-01-16T00:00:00Z', user: { login: 'user2', html_url: 'https://github.com/user2' } },
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
        create: (params: any) => {
          return { data: { 
            id: 999, number: 3, title: params.title, state: 'open', body: params.body,
            html_url: `https://github.com/testuser/test-repo/issues/3`,
            created_at: '2024-01-20T00:00:00Z', updated_at: '2024-01-20T00:00:00Z', closed_at: null,
            labels: [], assignees: [], user: { login: 'testuser', html_url: 'https://github.com/testuser', avatar_url: '' },
            comments: 0, milestone: params.milestone ? { number: params.milestone, title: 'Milestone 1', state: 'open', html_url: '', created_at: '', updated_at: '' } : null,
          } };
        },
        update: (params: any) => {
          const existing = mock.issueList.find((i: any) => i.number === params.issue_number);
          const updated = { 
            ...existing, 
            ...params, 
            labels: params.labels || (existing?.labels || []),
            assignees: params.assignees || (existing?.assignees || []),
            html_url: existing?.html_url || 'https://github.com/testuser/test-repo/issues/' + params.issue_number,
            created_at: existing?.created_at || '2024-01-10T00:00:00Z',
            updated_at: new Date().toISOString(),
            closed_at: params.state === 'closed' ? new Date().toISOString() : null,
          };
          return { data: updated };
        },
        updateMilestone: (params: any) => {
          const existing = mock.milestoneList.find((m: any) => m.number === params.milestone_number);
          return { data: { 
            number: params.milestone_number,
            title: params.title || existing?.title,
            description: params.description || existing?.description,
            state: params.state || existing?.state,
            due_on: params.dueOn || existing?.due_on,
            clear_due_on: params.clearDueOn || false,
            html_url: existing?.html_url || `https://github.com/testuser/test-repo/milestone/${params.milestone_number}`,
            created_at: existing?.created_at || '2024-01-01T00:00:00Z',
            updated_at: new Date().toISOString(),
            open_issues: existing?.open_issues || 0,
            closed_issues: existing?.closed_issues || 0,
          } };
        },
        listComments: () => ({ data: mock.comments || [] }),
        createComment: (params: any) => ({ 
          data: { 
            id: 200, body: params.body, created_at: new Date().toISOString(), 
            user: { login: 'testuser', html_url: 'https://github.com/testuser' } 
          } 
        }),
      },
      search: {
        repos: (params: any) => ({ 
          data: { 
            items: mock.repoList.filter((r: any) => r.name.toLowerCase().includes(params.q.toLowerCase()) || r.description?.toLowerCase().includes(params.q.toLowerCase())) 
          } 
        }),
        issuesAndPullRequests: (params: any) => {
          if (params.q.includes('type:milestone')) {
            return { data: { 
              items: mock.milestoneList.filter((m: any) => m.title.toLowerCase().includes(params.q.replace('type:milestone', '').trim().toLowerCase())) 
            } };
          }
          return { data: { 
            items: mock.issueList.filter((i: any) => i.title.toLowerCase().includes(params.q.toLowerCase()) || i.body?.toLowerCase().includes(params.q.toLowerCase())) 
          } };
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

  describe('createIssue', () => {
    it('should create an issue with title and body', async () => {
      const createdIssue = await service.createIssue('testuser', 'test-repo', 'New Issue', 'Issue body');
      expect(createdIssue.title).to.equal('New Issue');
      expect(createdIssue.body).to.equal('Issue body');
    });

    it('should create an issue with optional milestone', async () => {
      const createdIssue = await service.createIssue('testuser', 'test-repo', 'New Issue', 'Issue body', 1);
      expect(createdIssue.title).to.equal('New Issue');
    });

    it('should create an issue without milestone', async () => {
      const createdIssue = await service.createIssue('testuser', 'test-repo', 'Issue', 'Body', undefined);
      expect(createdIssue.title).to.equal('Issue');
    });
  });

  describe('updateIssue', () => {
    it('should update issue title', async () => {
      const updatedIssue = await service.updateIssue('testuser', 'test-repo', 1, { title: 'Updated Title' });
      expect(updatedIssue.title).to.equal('Updated Title');
    });

    it('should update issue body', async () => {
      const updatedIssue = await service.updateIssue('testuser', 'test-repo', 1, { body: 'Updated body' });
      expect(updatedIssue.body).to.equal('Updated body');
    });

    it('should update issue state', async () => {
      const updatedIssue = await service.updateIssue('testuser', 'test-repo', 1, { state: 'closed' });
      expect(updatedIssue.state).to.equal('closed');
    });
  });

  describe('updateMilestone', () => {
    it('should update milestone title', async () => {
      const updated = await service.updateMilestone('testuser', 'test-repo', 1, { title: 'Updated Milestone' });
      expect(updated.title).to.equal('Updated Milestone');
    });

    it('should update milestone description', async () => {
      const updated = await service.updateMilestone('testuser', 'test-repo', 1, { description: 'New description' });
      expect(updated.description).to.equal('New description');
    });

    it('should update milestone due date', async () => {
      const updated = await service.updateMilestone('testuser', 'test-repo', 1, { dueOn: '2025-12-31' });
      expect(updated.dueOn).to.equal('2025-12-31');
    });
  });

  describe('getComments', () => {
    it('should return comments for an issue', async () => {
      const fakeOctokit: any = {
        issues: {
          listComments: () => ({
            data: [
              { id: 1, body: 'First comment', created_at: '2024-01-15T00:00:00Z', user: { login: 'user1', html_url: 'https://github.com/user1' } },
              { id: 2, body: 'Second comment', created_at: '2024-01-16T00:00:00Z', user: { login: 'user2', html_url: 'https://github.com/user2' } },
            ],
          }),
        },
      };

      const testService = new GitHubService('test-token', () => fakeOctokit);
      const comments = await testService.getComments('testuser', 'test-repo', 1);
      expect(comments).to.have.lengthOf(2);
      expect(comments[0].body).to.equal('First comment');
      expect(comments[1].user.login).to.equal('user2');
    });

    it('should handle issue with no comments', async () => {
      const fakeOctokit: any = {
        issues: {
          listComments: () => ({ data: [] }),
        },
      };

      const testService = new GitHubService('test-token', () => fakeOctokit);
      const comments = await testService.getComments('testuser', 'test-repo', 1);
      expect(comments).to.have.lengthOf(0);
    });
  });

  describe('addComment', () => {
    it('should add a comment to an issue', async () => {
      const fakeOctokit: any = {
        issues: {
          createComment: () => ({
            data: { id: 100, body: 'New comment', created_at: '2024-02-01T00:00:00Z', user: { login: 'me', html_url: 'https://github.com/me' } },
          }),
        },
      };

      const testService = new GitHubService('test-token', () => fakeOctokit);
      const comment = await testService.addComment('testuser', 'test-repo', 1, 'New comment');
      expect(comment.body).to.equal('New comment');
      expect(comment.user.login).to.equal('me');
    });
  });

  describe('searchRepositories', () => {
    it('should search repositories by query', async () => {
      const fakeOctokit: any = {
        search: {
          repos: () => ({
            data: {
              items: [
                { id: 1, name: 'repo1', owner: { login: 'testuser' }, html_url: 'https://github.com/testuser/repo1', description: 'Repo 1' },
                { id: 2, name: 'repo2', owner: { login: 'testuser' }, html_url: 'https://github.com/testuser/repo2', description: 'Repo 2' },
              ],
            },
          }),
        },
      };

      const testService = new GitHubService('test-token', () => fakeOctokit);
      const repos = await testService.searchRepositories('repo');
      expect(repos).to.have.lengthOf(2);
      expect(repos[0].name).to.equal('repo1');
    });

    it('should return empty array when no repositories found', async () => {
      const fakeOctokit: any = {
        search: {
          repos: () => ({ data: { items: [] } }),
        },
      };

      const testService = new GitHubService('test-token', () => fakeOctokit);
      const repos = await testService.searchRepositories('nonexistent');
      expect(repos).to.have.lengthOf(0);
    });
  });

  describe('searchIssuesAndMilestones', () => {
    it('should search for issues', async () => {
      const fakeOctokit: any = {
        search: {
          issuesAndPullRequests: (params: any) => {
            if (params.q.includes('type:milestone')) {
              return { data: { items: [] } };
            }
            return {
              data: {
                items: [
                  {
                    id: 1, number: 1, title: 'Test Issue', state: 'open', body: 'Test', html_url: 'https://github.com/testuser/test-repo/issues/1',
                    created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-02T00:00:00Z', closed_at: null,
                    repository_url: 'https://api.github.com/repos/testuser/test-repo',
                    labels: [], assignees: [], user: { login: 'testuser', html_url: 'https://github.com/testuser', avatar_url: '' },
                    comments: 0, milestone: null,
                  },
                ],
              },
            };
          },
        },
      };

      const testService = new GitHubService('test-token', () => fakeOctokit);
      const results = await testService.searchIssuesAndMilestones('test');
      const issueResults = results.filter(r => r.type === 'issue');
      expect(issueResults).to.have.lengthOf(1);
      expect(issueResults[0].item.title).to.equal('Test Issue');
    });

    it('should search for milestones', async () => {
      const fakeOctokit: any = {
        search: {
          issuesAndPullRequests: (params: any) => {
            if (params.q.includes('type:milestone')) {
              return {
                data: {
                  items: [
                    {
                      number: 1, title: 'Test Milestone', state: 'open', html_url: 'https://github.com/testuser/test-repo/milestone/1',
                      created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-02T00:00:00Z',
                      repository_url: 'https://api.github.com/repos/testuser/test-repo',
                      body: 'Milestone body', due_on: '2024-12-31',
                    },
                  ],
                },
              };
            }
            return { data: { items: [] } };
          },
        },
      };

      const testService = new GitHubService('test-token', () => fakeOctokit);
      const results = await testService.searchIssuesAndMilestones('test');
      const milestoneResult = results.find(r => r.type === 'milestone');
      expect(milestoneResult).to.exist;
      expect(milestoneResult!.item.title).to.equal('Test Milestone');
    });
  });
});
