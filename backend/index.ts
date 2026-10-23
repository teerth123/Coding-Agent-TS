import express from "express"
import {agenticLoop} from "../Agent/index"

const app = express()
app.use(express.json())

app.post("/agent", async(req, res)=>{
    const {prompt} = req.body
    const result = await agenticLoop(prompt)

    return res.json({
        "msg":result
    })

})

app.listen(3000, ()=>{console.log("BE server running on 3k")})