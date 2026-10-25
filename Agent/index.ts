//sandboxing e2b
//memory management from the outside -- done
//subagents  -- done

import { OpenRouter } from "@openrouter/sdk";
import { type ChatToolMessage, type ChatFunctionTool, type ChatMessages, type ChatResult, falseToJSON, type ToolCall, type ChatToolCall } from "@openrouter/sdk/models";
import {bashTool, callLLM, readFile, writeFile, editFile, subAgent, githubTool} from "./Tools/index"
import {Sandbox} from "@e2b/code-interpreter";


const box = await Sandbox.create()


const openrouter_api_key = process.env.OPENROUTER_API_KEY

export const openrouter = new OpenRouter({
    apiKey:openrouter_api_key
})

export const tools:ChatFunctionTool[] = [
    {
        type:"function",
        function:{
            name:"bashTool",
            description:"bash tool to read, write, edit files and change directory everything",
            parameters:{
                type:"object",
                properties:{
                    command:{
                        type:"string",
                        description:"command for bash tool to execute"
                    }
                },
                required:["command"]
            },
        } ,
    },
    {
        type:"function",
        function:{
            name:"readFile",
            description:"to read content of the file , use this tool call",
            parameters:{
                type:"object",
                properties:{
                    fileName:{
                        type:"string",
                        description:"enter the filename or filepath both works"
                    }
                },
                required:["fileName"]
            },
        } ,
    },
    {
        type:"function",
        function:{
            name:"editFile",
            description:"to edit a file pass unique identifiable value and new value string to replace with ",
            parameters:{
                type:"object",
                properties:{
                    fileName:{
                        type:"string",
                    },
                    uniqueValue:{
                        type:"string",
                        description:"uniquely identifiable string to search and replace"
                    },
                    newValue:{
                        type:"string",
                        description:"new value to replace the old existing snippet of file"
                    }
                },
                required:["fileName", "uniqueValue", "newValue"]
            },
        } ,
    },
    {
        type:"function",
        function:{
            name:"writeFile",
            description:"to write new file or write existing file completely from scratch, pass fileName and content as params",
            parameters:{
                type:"object",
                properties:{
                    fileName:{
                        type:"string",
                    },
                    content:{
                        type:"string",
                    }
                },
                required:["fileName", "content"]
            },
        } ,
    },
    {
        type:"function",
        function:{
            name:"subAgent",
            description:"to delegate a task to subagent, subagent works completely on its own, it doesnt have any relevant context about the prior work, you give it a detailed prompt, it hands over you the output",
            parameters:{
                type:"object",
                properties:{
                    prompt:{
                        type:"string",
                    }
                },
                required:["prompt"]
            },
        } ,
    },
    {
        type:"function",
        function:{
            name:"githubTool",
            description:"github actions: clone, pull, createBranch, push (commits all changes and pushes the branch), createPR, listPRs, listIssues, getIssue, commentIssue. Authentication is handled automatically, never ask for or pass a token. Never push to main, always createBranch first, push that branch, then createPR.",
            parameters:{
                type:"object",
                properties:{
                    action:{
                        type:"string",
                        enum:["clone","pull","createBranch","push","createPR","listPRs","listIssues","getIssue","commentIssue"],
                        description:"which github action to run"
                    },
                    repo:{
                        type:"string",
                        description:"repo in the form owner/name, needed for clone, createPR, listPRs, listIssues, getIssue, commentIssue"
                    },
                    dir:{
                        type:"string",
                        description:"local folder of the cloned repo, needed for pull, createBranch, push"
                    },
                    branch:{
                        type:"string",
                        description:"branch name, needed for createBranch, push, createPR"
                    },
                    message:{
                        type:"string",
                        description:"commit message, needed for push"
                    },
                    title:{
                        type:"string",
                        description:"pull request title, needed for createPR"
                    },
                    body:{
                        type:"string",
                        description:"pull request description or issue comment text"
                    },
                    base:{
                        type:"string",
                        description:"branch the pull request merges into, default main"
                    },
                    issueNumber:{
                        type:"number",
                        description:"issue number, needed for getIssue and commentIssue"
                    }
                },
                required:["action"]
            },
        } ,
    },
]

const toolMapRegistry = {
    "bashTool":bashTool,
    "readFile":readFile, 
    "writeFile":writeFile, 
    "editFile":editFile,
    "subAgent":subAgent,
    "githubTool":githubTool
}

async function toolsRouter(
  toolcall: ChatToolCall
): Promise<ChatToolMessage> {

  let isResolved = false;
    console.log(" ------ " + toolcall.function.name + " ------ " )
  return new Promise<ChatToolMessage>(async (resolve, reject) => {

    const timer = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;

        return resolve({
          role: "tool",
          toolCallId: toolcall.id,
          content: JSON.stringify({
            stderr: "timed out, taking longer than 5 secs"
          })
        });
      }
    }, 5000);

    try {
      const args = JSON.parse(toolcall.function.arguments);

      const Tool =
        toolMapRegistry[
          toolcall.function.name as keyof typeof toolMapRegistry
        ];

      const result = await Tool(args);

      if (isResolved) {
        return;
      }

      isResolved = true;
      clearTimeout(timer);

      resolve({
        role: "tool",
        toolCallId: toolcall.id,
        content: JSON.stringify(result)
      });

    } catch (error) {
      if (isResolved) {
        return;
      }

      isResolved = true;
      clearTimeout(timer);

      reject(error);
    }
  });
}

export async function agenticLoop(history:unknown[]){


    const maxIterations = 25
    let currentIterations = 0
    let isFinished = false

    const messages = history as ChatMessages[]

    while(currentIterations < maxIterations && !isFinished){
        
        const result = await callLLM(messages)

        const choice =  result.choices[0]

        if(!choice){
            throw new Error("expected choice")
        }

        const toolCalls = choice.message.toolCalls
        
        
        if(!toolCalls || toolCalls.length === 0){
            isFinished = true
            break
        }

        for(const toolCall of toolCalls){
            const result = await toolsRouter(toolCall)
            messages.push(result)
            console.log(result)
        }
    }


    const lastMessage = messages[messages.length -1]?.content
    console.log(lastMessage)
    return lastMessage
}