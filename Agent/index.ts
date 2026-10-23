// writing new tool calls - read, write, edit, bash, search
//rem - securing bash tool, search tool
//currently every tool is accepting args in its own way, so make it use object in its format, 

import { OpenRouter } from "@openrouter/sdk";
import { type ChatToolMessage, type ChatFunctionTool, type ChatMessages, type ChatResult, falseToJSON, type ToolCall, type ChatToolCall } from "@openrouter/sdk/models";
import {bashTool, callLLM, readFile, writeFile, editFile} from "./Tools/index"

export const openrouter = new OpenRouter({
    apiKey:process.env.OPENROUTERKEY
})

const messages:ChatMessages[] = [
    {
        role:"system",
        content:"you are helpful coding agent"
    }
]

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
] 

const toolMapRegistry = {
    "bashTool":bashTool,
    "readFile":readFile, 
    "writeFile":writeFile, 
    "editFile":editFile
}

async function toolsRouter(toolcall:ChatToolCall):Promise<ChatToolMessage>{
   


    const {command} = JSON.parse(toolcall.function.arguments) as {command:string}

    const result = await bashTool(command)
    return {
        role:'tool',
        toolCallId:toolcall.id,
        content:JSON.stringify(result)
    }

}

export async function agenticLoop(prompt:string){

    const maxIterations = 25
    let currentIterations = 0
    let isFinished = false
    messages.push({role:"user", content:prompt})


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
        }
    }


    const lastMessage = messages[messages.length -1]?.content
    console.log(lastMessage)
    return lastMessage
}