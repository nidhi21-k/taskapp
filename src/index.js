require('./db/mongoose')
const express = require('express')
const app = express()

const userRouter = require('./routers/user') //get user routes
const taskRouter = require('./routers/task')

const port = process.env.PORT || 3000

app.use(express.json())     // parse json into object
app.use(userRouter);
app.use(taskRouter);

app.listen(port,()=>{
    console.log('server is up on port ' + port)
});