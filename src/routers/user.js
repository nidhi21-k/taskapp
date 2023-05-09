const express = require('express')
const User = require('../models/user')   // user model
const router = new express.Router();
const auth = require('../middleware/auth')
const Task = require('../models/task'); //task model
const mongoose = require('mongoose')

// upload user data by default employee otherwise manager
//---------------------------
router.post('/users',async (req,res)=>{
    const user = new User(req.body)
    try{
        await user.save();
        const token = await user.generateAuthToken();
        res.status(201).send({user,token});
    }
    catch(e){
        res.status(400).send(e);
    }
});

// user login
router.post('/users/login',async(req,res)=>{
    try{
        const user = await User.findByCredentials(req.body.email,req.body.password);
        const token = await user.generateAuthToken();
        res.send({user,token})
    }catch(e){      
        res.status(400).send();
    }
});

// user current session logout
router.post('/users/logout',auth,async(req,res)=>{
    try{
        req.user.tokens = req.user.tokens.filter((token) =>{
            return token.token !== req.token
        })
        await req.user.save()
        res.send()
    }catch(e){
        res.status(500).send()
    }
})

// all user session logout
router.post('/users/logoutAll',auth,async(req,res)=>{
    try{
        req.user.tokens = [];
        await req.user.save();
        res.send();
    }catch(e){
        res.status(500).send();
    }
})

//GET - /users?avgLoad=true  : Manager - can see average load (of priority) wise employee list, Employee - not eligible for this option
//GET - /users?role=manager  : Manager - can see manager list or employee list, Employee - not eligible for this option
//--------------------------------
router.get('/users',auth,async (req,res)=>{
    let findCondition = {};
    let avgPriority = {};
    
    if (req.user.role === 'manager'){
        if(req.query.role){
            findCondition = {role : req.query.role}
        }
        if(req.query.avgLoad){           
           avgPriority = await Task.aggregate([
                { $group: {_id: "$assignto", avgvalue: {$avg: "$priority"}}}
             ]).sort({avgvalue : req.query.avgLoad === 'ASC' ? 1 : -1});
        }
    }
    try{
        const result = await User.aggregate([{
            $lookup: {
              from: '$avgPriority',
              localField: "_id",
              foreignField: "_id",
              as: "result"
            },
        }]);
        
        const users = await User.find(findCondition);
        res.send(users);

    }catch(e){
        res.status(500).send();
    }
});

// update user data
//-------------------------------
router.patch('/users/:_id',auth, async(req,res) => {

    let allowedUpdates = [];
    
    if(req.user.role === 'manager'){
        allowedUpdates = ['name','role','email','password','contactno','address'];
    }
    else{
        if(req.user._id.toString() === req.params._id){
            allowedUpdates = ['name','contactno','address'];
        }
        else{
            return res.status(400).send({'warning' : "can't update others information."})
        }
    }

    const updates = Object.keys(req.body);
    
    const isValidOperation = updates.every((update) => allowedUpdates.includes(update));

    if(! isValidOperation){
        return res.status(400).send({'error' :'Invalid updates.'});
    }

    try{
        // findByIdAndUpdate() doesn't support mongoose middleware so updated value manually in document object
        //-----------------------------------------------
        req.user = req.user.role === 'manager' ? await User.findById(req.params._id) : req.user;
        updates.forEach((update) => req.user[update] = req.body[update]);
        await req.user.save();

        res.send(req.user);
    }catch(e){
        res.status(500).send(e);
    }
});

//delete user
router.delete('/users/:_id',auth, async(req,res)=>{
    if(req.user.role === 'employee'){
        return res.status(400).send({'error':'you have no rights for this operation.'});
    }
    try {
        const user = await User.findByIdAndDelete(req.params._id);
        res.send(user);
    } catch (e) {
        res.status(500).send()
    }
});

module.exports = router;