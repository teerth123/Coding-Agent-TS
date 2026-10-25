import { type ChatMessages, type ChatResult } from "@openrouter/sdk/models"
import {tools, openrouter, agenticLoop} from "../index.ts"
const github_pat = process.env.GITHUB_PAT

export async function bashTool(args:{command:string}):Promise<object>{
    
    // GITHUB_PAT is removed from the env so the llm can't read it with `echo $GITHUB_PAT` or `env`
    const result = await Bun.$`bash -c ${args.command}`.env({...process.env, GITHUB_PAT:undefined}).nothrow()

    return {
        result:result,
        stderr:result.stderr.toString(),
        stdout:result.stdout.toString()
    }
}

export async function callLLM(messages:ChatMessages[]):Promise<ChatResult> {
    const result = await openrouter.chat.send({
        chatRequest:{
            messages,
            tools,
            stream:false,
            model:"openrouter/auto"
        }
    })

    if(!('choices' in result)){
        throw new Error("expected choices in llm call result")
    }

    const choice = result.choices[0]
    if(!choice){
        throw new Error("expected choices in llm call Result") 
    } 

    messages.push(choice?.message)
    console.log()
    return result
}

export async function writeFile(args:{fileName:string, content:string}){
    const result = await Bun.write(args.fileName, args.content)
    return {
        result:result
    }
}

export async function readFile(arg:{fileName:string}){
    const readFile = await Bun.file(arg.fileName).text()
    return {
        result :readFile
    }
}

export async function editFile(args:{fileName:string, uniqueValue:string, newValue:string}){
    let content = await Bun.file(args.fileName).text()

    content = content.replace(args.uniqueValue, args.newValue)
    const fileName = args.fileName
    const newArgs = {
        fileName, 
        content
    }
    const result = await writeFile(newArgs)

    return {result}
}

export async function subAgent(args:{prompt:string}){
    
    if(!args.prompt || typeof(args.prompt)==undefined){
        throw new Error("prompt is not string")
    }

    const newmessages : ChatMessages[] = [{
        role:"system",
        content:"You are a subagent spawned by a parent coding agent. You do not have access to the parent agent's conversation, reasoning, hidden context, or previous interactions. You only have access to the task explicitly provided to you and the tools available to you. Your job is to independently complete the assigned task from start to finish. Inspect the codebase and relevant files before making assumptions, use your tools as needed, follow existing project conventions, make only the changes necessary for the task, and verify your work when possible. Do not ask the parent agent to perform work that you can perform yourself. Do not assume any context that is not explicitly provided in the task. When finished, briefly report what you did, what files or components you changed, how you verified the result, and any remaining issues or assumptions. Do not claim to have performed an action unless you actually performed it."
    },
    {
        role:"developer",
        content:args.prompt
    }
    ]

    const result = await agenticLoop(newmessages)
    return {result}
}

// ---------------- github tool ----------------
// the PAT is read from .env above (github_pat), the llm never passes it and never sees it

type GithubArgs = {
    action:"clone" | "pull" | "createBranch" | "push" | "createPR" | "listPRs" | "listIssues" | "getIssue" | "commentIssue",
    repo?:string,           // "owner/name"
    dir?:string,            // local folder of the cloned repo
    branch?:string,
    message?:string,        // commit message
    title?:string,          // PR title
    body?:string,           // PR body or comment text
    base?:string,           // branch the PR should merge into, default "main"
    issueNumber?:number
}

// git gets the PAT as an auth header through env vars, so it is never in the command or its output
function gitEnv(){
    const token = Buffer.from(`x-access-token:${github_pat}`).toString("base64")
    return {
        ...process.env,
        GIT_TERMINAL_PROMPT:"0", // never wait for a username/password prompt
        GIT_CONFIG_COUNT:"1",
        GIT_CONFIG_KEY_0:"http.https://github.com/.extraheader",
        GIT_CONFIG_VALUE_0:`AUTHORIZATION: basic ${token}`
    }
}

async function runGit(args:string[], dir?:string){
    const result = await Bun.$`git ${args}`.cwd(dir ?? process.cwd()).env(gitEnv()).nothrow().quiet()
    return {
        stdout:result.stdout.toString(),
        stderr:result.stderr.toString(),
        exitCode:result.exitCode
    }
}

async function githubApi(method:string, path:string, body?:object){
    const res = await fetch(`https://api.github.com${path}`, {
        method,
        headers:{
            Authorization:`Bearer ${github_pat}`,
            Accept:"application/vnd.github+json",
            "User-Agent":"coding-agent",
            "Content-Type":"application/json"
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30000)
    })

    const data:any = await res.json().catch(() => null)
    if(!res.ok){
        return {error:`github api failed with ${res.status}`, message:data?.message}
    }
    return data
}

export async function githubTool(args:GithubArgs):Promise<object>{
    if(!github_pat){
        return {error:"GITHUB_PAT is missing in .env"}
    }

    const {action, repo, dir, branch, message, title, body, issueNumber} = args
    const base = args.base ?? "main"

    // these actions need a repo like "owner/name"
    const needsRepo = ["clone", "createPR", "listPRs", "listIssues", "getIssue", "commentIssue"]
    if(needsRepo.includes(action) && !(repo && /^[\w.-]+\/[\w.-]+$/.test(repo))){
        return {error:"repo is required in the form owner/name"}
    }

    // these actions run inside a local folder
    const needsDir = ["pull", "createBranch", "push"]
    if(needsDir.includes(action) && !dir){
        return {error:"dir is required (the local folder of the repo)"}
    }

    switch(action){
        case "clone":
            return await runGit(["clone", `https://github.com/${repo}.git`, dir ?? repo!.split("/")[1]!])

        case "pull":
            return await runGit(["pull"], dir)

        case "createBranch":
            if(!branch) return {error:"branch is required"}
            return await runGit(["checkout", "-b", branch], dir)

        case "push":{
            if(!branch || !message) return {error:"branch and message are required"}
            await runGit(["add", "-A"], dir)
            const commit = await runGit(["commit", "-m", message], dir)
            if(commit.exitCode !== 0) return commit   // e.g. nothing to commit, or git user.name not set
            return await runGit(["push", "-u", "origin", branch], dir)
        }

        case "createPR":{
            if(!title || !branch) return {error:"title and branch are required"}
            const pr = await githubApi("POST", `/repos/${repo}/pulls`, {title, head:branch, base, body})
            return pr.error ? pr : {number:pr.number, url:pr.html_url}
        }

        case "listPRs":{
            const prs = await githubApi("GET", `/repos/${repo}/pulls?state=open`)
            return prs.error ? prs : prs.map((p:any) => ({number:p.number, title:p.title, url:p.html_url}))
        }

        case "listIssues":{
            const issues = await githubApi("GET", `/repos/${repo}/issues?state=open`)
            if(issues.error) return issues
            // this endpoint also returns PRs, so drop them
            return issues.filter((i:any) => !i.pull_request).map((i:any) => ({number:i.number, title:i.title, url:i.html_url}))
        }

        case "getIssue":{
            if(!issueNumber) return {error:"issueNumber is required"}
            const issue = await githubApi("GET", `/repos/${repo}/issues/${issueNumber}`)
            return issue.error ? issue : {number:issue.number, title:issue.title, body:issue.body, state:issue.state, url:issue.html_url}
        }

        case "commentIssue":{
            if(!issueNumber || !body) return {error:"issueNumber and body are required"}
            const comment = await githubApi("POST", `/repos/${repo}/issues/${issueNumber}/comments`, {body})
            return comment.error ? comment : {url:comment.html_url}
        }

        default:
            return {error:`unknown action ${action}`}
    }
}

