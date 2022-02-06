import axios from 'axios';
import { DateTime } from "luxon";

export default class {
    constructor({username, password}) {
        this.login = null;

        this.client = axios.create({
            baseURL: 'https://api.bitbucket.org/2.0',
            auth: { 
                username: username,
                password: password,
            }
        })
    }

    async getLogin() {
        const response = await this.client.get('/user')
        return response.data || null
    }

    async fetchWorkspaces() {
        const response = await this.client.get('/user/permissions/workspaces')
        const values = response.data.values || []
        if (values.length === 0) {
            return []
        }

        const workspaces = values.map(({workspace}) => {
            return {
                uuid: workspace.uuid,
                name: workspace.name,
                slug: workspace.slug
            }
        });

        return workspaces
    }

    async fetchRepositories(workspace) {
        const response = await this.client.get(`/workspaces/${workspace}/permissions/repositories`)
        const values = response.data.values || []
        if (values.length === 0) {
            return []
        }

        const repositories = values.map(({repository}) => {
            return {
                uuid: repository.uuid,
                name: repository.name,
                full_name: repository.full_name,
                workspace_uuid: workspace
            }
        })

        return repositories
    }

    async getRepositories() {
        const workspaces = await this.fetchWorkspaces()

        const repositories = []
        for (const workspace of workspaces) {
            try {
                const workspaceRepositories = await this.fetchRepositories(workspace.uuid)
                repositories.push(...workspaceRepositories)
            } catch (error) {
                // Do nothing
            }
        }

        return repositories
    }

    async getCommits(workspace, repo, owner = null) {
        try {
            const response = await this.client.get(`/repositories/${workspace}/${repo}/commits/`)
            const values = response.data.values || []
            if (values.length === 0) {
                return []
            }

            if (owner === null) {
                return values
            }

            const commits = values.filter(({author}) => {
                return author.uuid === owner.uuid
            })

            return commits
        } catch (error) {

        }
        
        return []
    }

    async getAllMyCommits() {
        const repositories = await this.getRepositories()

        const commits = []
        const owner = await this.getLogin()

        for (const repository of repositories) {
            const commitsForRepo = await this.getCommits(repository.workspace_uuid, repository.uuid, owner.uuid)
            commits.push(...commitsForRepo)
        }

        return commits
    }

    async getCommitCount(times, weekdays) {
        const commits = await this.getAllMyCommits()

        const localTimes = JSON.parse(JSON.stringify(times))
        const localWeekdays = JSON.parse(JSON.stringify(weekdays))
        
        for (const commit of commits) {
            const commitDate = DateTime.fromISO(commit.date).setZone("Pacific/Auckland")

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