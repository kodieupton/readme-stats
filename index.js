import { Octokit, App } from "octokit";
import 'dotenv/config'
import { DateTime } from "luxon";
import { Base64 } from "js-base64";
import core from '@actions/core'

const authToken = core.getInput('GH_ACCESS_TOKEN') || process.env.GH_ACCESS_TOKEN

if (!authToken) {
    core.setFailed('Auth Token not provided');
}

const octokit = new Octokit({ auth: authToken });

const makeGraph = (percentage) => {
    const doneBlock = '█'
    const emptyBlock = '░'

    const percentageRound = (percentage.toFixed() / 4).toFixed()

    let graph = ''
    for (let i = 0; i < 25; i++) {
        if (i < percentageRound) {
            graph += doneBlock
        } else {
            graph += emptyBlock
        }
    }

    return graph
}

const createList = (dataList) => {
    const total = Object.values(dataList).reduce((a, b) => a + b);
    let list = ''
    for (const [key, value] of Object.entries(dataList)) {
        const spaces = (str, num) => {
            let s = ''
            const ln = str.length

            for (let i = 0; i < (num - ln); i++) {
                s += ' '
            }

            return s
        }

        const commitTotal = `${value} commit${value === 1 ? '' : 's'}`
        const percentage = ((value / total) * 100)

        list += `${key}:${spaces(key, 13)}${commitTotal}${spaces(commitTotal, 15)}${makeGraph(percentage)}${spaces('', 5)}${percentage.toFixed(2)}%\n\n`
    }

    return list
}

const run = async () => {

    const {
        data: { login },
    } = await octokit.rest.users.getAuthenticated();
    
    const { data: repositories } = await octokit.request('GET /user/repos', { type: 'private' })

    const owner = login

    let times = {
        morning: 0, // 6 - 12
        daytime: 0, // 12 - 18
        evening: 0, // 18 - 24
        night: 0 // 0 - 6
    }

    let weekdays = {
        Monday: 0,
        Tuesday: 0,
        Wednesday: 0,
        Thursday: 0,
        Friday: 0,
        Saturday: 0,
        Sunday: 0
    }

    let total = 0

    for (const repo of repositories) {
        const { data: commits } = await octokit.request('GET /repos/:owner/:repo/commits', {
            owner,
            repo: repo.name
        })

        for (const commit of commits) {
            const commitDate = DateTime.fromISO(commit.commit.committer.date)

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

            total += 1
        }
    }

    const weekdaysList = createList(weekdays)
    const timesList = createList(times)

    const key = `GITHUB STATS`
    const commentBegin = `<!-- `
    const commentEnd = ` -->`

    const readme = await octokit.rest.repos.getReadme({
        owner: login,
        repo: login
    });

    let content = Base64.decode(readme.data.content)

    const beginTokenPattern = `(${commentBegin}\\s*?${key} START\\s*?${commentEnd}.*?[\\r\\n]+)`;
    const endTokenPattern   = `(${commentBegin}\\s*?${key} END\\s*?${commentEnd})`;
    const contentPattern    = '[\\s\\S]*?';
    const sourceContent = '### Weekday stats\n<pre>' + weekdaysList + '</pre>\n\n\n ### Time of day stats\n<pre>' + timesList + '</pre>'

    const RX = new RegExp(`${beginTokenPattern}${contentPattern}${endTokenPattern}`, 'g');
    const newContent = content.replace(RX, `$1${sourceContent}$2`)

    const contentEncoded = Base64.encode(newContent);

    try {
        await octokit.rest.repos.createOrUpdateFileContents({
            owner: login,
            repo: login,
            path: 'README.md',
            message: "chore: Added README.md programatically",
            content: contentEncoded,
            sha: readme.data.sha,
            committer: {
                name: `Octokit Bot`,
                email: "kodieupton@gmail.com",
            },
            author: {
                name: "Octokit Bot",
                email: "kodieupton@gmail.com",
            },
        });

        console.log('Readme updated')
    } catch (error) {
        console.error(error.message);
    }
    
}

run();
