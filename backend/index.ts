import express from "express"
import {agenticLoop} from "../Agent/index"

const app = express()
app.use(express.json())

app.post("/agent", async(req, res)=>{
    const {prompt, memoryID} = req.body

    const history = [{
            role:"system",
            content:"you are helpful coding agent with tools"
        }]

    //making db call to get the memory object with the memory id
    if(!memoryID){
        history.push(
        {
            role:"user",
            content:prompt
        }
        )
    }
    const result = await agenticLoop(history)

    return res.json({
        "msg":result
    })

})

app.listen(3000, ()=>{console.log("BE server running on 3k")})