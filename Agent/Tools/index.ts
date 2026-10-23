import type { ChatMessages, ChatResult } from "@openrouter/sdk/models"
import { file, stderr } from "bun"
import {tools, openrouter} from "../index.ts"


export async function bashTool(command:string):Promise<object>{
    
    const result = await Bun.$`bash -c ${command}`.nothrow()
    
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

export async function writeFile(fileName:string, content:string){
    const result = await Bun.write(fileName, content)
    return {
        result:result
    }
}

export async function readFile(fileName:string){
    const readFile = await Bun.file(fileName).text()
    return {
        result :readFile
    }
}

export async function editFile(fileName:string, uniqueValue:string, newValue:string){
    const content = await Bun.file(fileName).text()

    content.replace(uniqueValue, newValue)

    const result = await writeFile(fileName, content)

    return result
}