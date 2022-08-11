import { Octokit, App } from "octokit";
import { DateTime } from "luxon";

export default class {
    constructor(authToken) {
        this.authToken = authToken;
        this.login = null;

        this.octokit = new Octokit({ auth: authToken });
    }

    async getLogin() {

        if (this.login) {
            return this.login
        }

        const {
            data: { login },
        } = await this.octokit.rest.users.getAuthenticated();

        this.login = login;

        return login
    }

    async getRepositories() {
        const { data: repositories } = await this.octokit.request('GET /user/repos', {
            type: 'private'
        })
        return repositories
    }

    async getBranches(repo, owner = null) {
        if (!owner) {
            owner = await this.getLogin()
        }

        try {
            const { data } = await this.octokit.request('GET /repos/:owner/:repo/branches', {
                owner,
                repo: repo.name
            })
        } catch (error) {
            console.error(error)
            return []
        }
        
        return data ?? [];
    }

    async getCommits(repo, owner = null, branch = null) {
        if (!owner) {
            owner = await this.getLogin()
        }

        const query = {
            per_page: 100,
            page: 1
        };
        if (branch && branch.name) {
            query.sha = branch.name
        }

        const repoCommits = [];
        let commitLength = 0;
        let safety = 0;

        do {
            const queryString  = new URLSearchParams(query).toString()
            const { data: commits } = await this.octokit.request(`GET /repos/:owner/:repo/commits?${queryString}`, {
                owner,
                repo: repo.name,
            })

            repoCommits.push(...commits)
            query.page += 1
            commitLength = commits.length
            
            safety += 1
            if (safety > 50) {
                throw new Error('Too many requests');
            }
        } while (commitLength === 100);

        return repoCommits
    }

    async getReadme(owner = null) {
        let login = owner

        if (!owner) {
            login = await this.getLogin()
        }

        return await this.octokit.rest.repos.getReadme({
            owner: login,
            repo: login
        });
    }

    async createOrUpdateFileContents({owner = null, repo = null, path = null, message = null, content = null, sha = null, committer = null, author = null}) {
        if (!owner) {
            owner = await this.getLogin()
        }

        await this.octokit.rest.repos.createOrUpdateFileContents({
            owner: owner,
            repo: repo,
            path: path,
            message: message,
            content: content,
            sha: sha,
            committer: committer,
            author: author,
        });
    }

    async getAllMyCommits() {
        const repositories = await this.getRepositories()

        const commits = []
        const owner = await this.getLogin()

        for (const repo of repositories) {
            const branches = await this.getBranches(repo, owner)
                
            for (const branch of branches) {
                const commitsForRepo = await this.getCommits(repo, owner, branch)
                commits.push(...commitsForRepo)
            }       
        }

        function getUniqueListBy(arr, key) {
            return [...new Map(arr.map(item => [item[key], item])).values()]
        }

        return getUniqueListBy(commits, 'sha')
    }

    async getCommitCount(times, weekdays) {
        const commits = await this.getAllMyCommits()

        const localTimes = JSON.parse(JSON.stringify(times))
        const localWeekdays = JSON.parse(JSON.stringify(weekdays))
        
        for (const commit of commits) {
            const commitDate = DateTime.fromISO(commit.commit.committer.date).setZone("Pacific/Auckland")

            const weekday = commitDate.weekdayLong
            const hour = commitDate.hour

            if (hour >= 6 && hour < 12) {
                times.morning += 1
            } else if (hour >= 12 && hour < 18) {
                times.daytime += 1
            } else if (hour >= 18 && hour < 24) {
                times.evening += 1
            } else if (hour >= 0 && hour < 6) {
                times.night += 1
            }

            weekdays[weekday] += 1
        }

        return {
            times: times,
            weekdays: weekdays
        }
    }
}