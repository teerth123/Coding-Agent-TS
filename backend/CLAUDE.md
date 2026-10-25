1. I have to pass the memory from outside, the problem I was thinking was is that - how can i pass it from backend, I have to first install openrouter sdk for that, ultimately the decision I made is just passing single json instead of making it chatMessages from openrouter
2. subagents concept is too broad --> i want to implement multiagent orchestration, for that I need to allow creating subagents by subagents. For this I need to count depth every time. 
3. There are so many things like catching the bug or error introduced due to wrong input and timeout and such things, also auth and all , so its a lot of polishing work is remaining
4. 


### Whats remaining

#### Polishing
1. auth, try catch

#### Imp
1. compaction, summarization, depth - multiagent orchestration
2. Checkpointing, Temporal(durable agents)



This project is built in stages. 
Stage 1) Agentic Loop
just while loop that makes multiple calls to llm and performs tasks with single bash tool. 
Stage 2) Better Agent
Fewer better tools >> many basic or useless tools
Stage 3) sandboxing usingn E2B
not done yet
Stage 4) context engineering
subagents, compaction, summarization
Stage 5) Github
commit statuses, contents, issues, PR these 4 read and write permissions are given via PAT, used PAT cuz its for personal project, oauth or github apps are better ways to make it production ready or commercialise. 


1. Yeah, I have to consume a lot of stuff from langchain people, their YT and twitter posts are so much resourceful. 


