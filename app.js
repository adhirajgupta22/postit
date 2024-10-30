const cookieParser = require('cookie-parser');
const express= require('express');
const userModel = require('./models/user');
const postModel = require('./models/post');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(cookieParser());

app.get("/",(req,res)=>{
    res.render("index");
});
app.post("/register",async (req,res)=>{
    let {email,password,username,name,age}= req.body;
    
    let user = await userModel.findOne({email:email});
    if(user) return res.status(500).send("user already registered");

    bcrypt.genSalt(10,(err,salt)=>{
        bcrypt.hash(password,salt,async (err,hash)=>{
            let user = await userModel.create({
                username,
                email,
                age,
                password:hash,
                name
            });

            let token= jwt.sign({email:email,userid:user._id},"secretkey");
            res.cookie("token",token);
            res.send("registered")
        })
    })  
});

app.get("/login",(req,res)=>{
    res.render('login');
});
app.post("/login",async (req,res)=>{
    let {email,password} = req.body;
    let user = await userModel.findOne({email});
    if(!user) return res.status(500).send("something went wrong");

    bcrypt.compare(password,user.password,(err,result)=>{
        if(result){
            let token= jwt.sign({email:email,userid:user._id},"secretkey");
            res.cookie("token",token);
            res.status(200).redirect('/profile') //send("Logged in");
        }    
        else res.redirect('/login');  //vese this is not a very good authenticator structure as email glt pe something went wrong bolrha aur passs glt pe redirect kr rha to ye hack kiya ja skta hai
    });
});

app.get('/logout',(req,res)=>{
    res.cookie("token","");
    res.redirect('/login');
})

function isloggedin(req,res,next){  //a middleware can be used in protected logged in pages eg /profile
    if(req.cookies.token ==="") res.redirect('login');//res.send("You must be logged in");
    else{
        let data = jwt.verify(req.cookies.token,"secretkey");
        req.user=data;  //so that we can see the data of user using req
        next();
    }
}

app.get('/profile',isloggedin,async (req,res)=>{
    let user = await userModel.findOne({email:req.user.email}).populate("posts");
    res.render('profile',{user:user});
});

app.get('/like/:id',isloggedin,async (req,res)=>{
    let post = await postModel.findOne({_id:req.params.id}).populate("user");
    // post.likes.push()
    // console.log(req.user);
    if(post.likes.indexOf(req.user.userid)===-1){  //like list me user nahi hai abhi
        post.likes.push(req.user.userid);
    }
    else{
        //post.likes.indexOf(req.user.userid)
        post.likes.splice(post.likes.indexOf(req.user.userid),1);
    }
    //post.likes.push(req.user.userid); post ke like array me humne userid put krdi hai ie vo users jo us post ko like kr rhe hai
    await post.save();
    res.redirect("/profile")
});

app.get('/edit/:id',isloggedin,async (req,res)=>{
    let post = await postModel.findOne({_id:req.params.id}).populate("user");
    // console.log(post);
    res.render('edit',{post});
});
app.post('/update/:id',isloggedin,async (req,res)=>{
    let post = await postModel.findOneAndUpdate({_id:req.params.id},{content:req.body.content}).populate("user");
    res.redirect("/profile");
});
app.get('/delete/:id',isloggedin,async (req,res)=>{
    const postid = req.params.id;

        try {
            const post = await postModel.findByIdAndDelete(postid);
            // console.log(req.user);  //-> inside userid
            // console.log(req.params);
            //removing the post from the user post array
            await userModel.updateOne({_id:req.user.userid},{$pull:{posts:postid}}); //user.userid will give the id of the user that is logged in
            res.redirect('/profile');
        } catch (error) {
                console.error(error);
                res.status(500).send("Error deleting post");
        }
}); 

app.post('/post',isloggedin,async (req,res)=>{
    let user = await userModel.findOne({email:req.user.email});
    let {content} = req.body;

    if (!content || content.trim().length === 0) {
        return res.status(400).send("Content cannot be empty.");
    }
    
    let post = await postModel.create({
        user:user._id,
        content: content
    });
    user.posts.push(post._id);
    await user.save();
    res.redirect('/profile');
});


app.listen(3000);
