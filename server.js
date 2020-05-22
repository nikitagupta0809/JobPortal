const express = require('express');
const app = express()
const { pool } = require('./dbConfig');
const bcrypt = require('bcrypt')
const session = require('express-session');
const flash = require('express-flash');
const passport = require('passport');
const router = require('router');
const initializePassport = require('./passportConfig');

initializePassport(passport);

const PORT = process.env.PORT || 4000;

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }));
app.use(session({
    secret: 'secret', 
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(flash());
app.get('/', (req, res) => {
    res.render('index');
});

app.get('/users/register', checkAuthenticated, (req, res)=>{
    res.render('register');
});

app.get('/users/login', checkAuthenticated, (req, res)=>{
    res.render('login');
});

app.get('/users/dashboardCand', checkNotAuthenticated, (req, res)=>{
    res.render('dashboardCand', {user: req.user.email, role: req.user.role});
});

app.get('/users/dashboardRec', checkNotAuthenticated, (req, res)=>{
    res.render('dashboardRec', {user: req.user.email, role: req.user.role});
});

app.get('/users/logout', (req, res) =>{
    req.logOut();
    req.flash("success_msg", "You have logged out successfully!");
    res.redirect("/users/login");
})
app.post('/users/register',  async (req, res) => {
    let { role, email, password, password2 } = req.body;
    console.log({
        role,
        email,
        password,
        password2
    });
    // form validation
    let errors = [];
    if(!role || !email || !password || !password2){
        errors.push({ message: "Please enter all fields!"});
    }
    if(password.length < 6){
        errors.push({ message: "Password should be atleast 6 characters"});
    }
    if(password != password2){
        errors.push({ message: "Passwords do not match!" });
    }
    if(errors.length > 0){
        res.render('register', { errors });
    }
    //console.log(errors)
    else{
        //form validation complete
        let hashedPassword = await bcrypt.hash(password, 10);
        console.log("hashed password:", hashedPassword);
        pool.query(
            `SELECT * FROM login WHERE email = $1`, [email], (err, results)=>{
                if(err){
                    throw err
                }
                console.log(results.rows)

                if(results.rows.length > 0){
                    errors.push({ message: "User already registered!"})
                    res.render('register', { errors })
                }
                else{
                    pool.query(
                        `INSERT INTO login (role, email, password) values ($1, $2, $3)`,
                         [role, email, hashedPassword], (err, results)=>{
                            if(err){
                                throw err;
                            }
                            console.log(results.rows);
                            req.flash('success_msg', "You have successfully registered! Please login.");
                            res.redirect('/users/login');
                        }
                    )
                }
            }
        )
    }
}); 

app.post(
    '/users/login',
    passport.authenticate('local', {
      failureRedirect: '/users/login'
    }), (req, res) => {
      if (req.user.role === 'recruiter') {
        res.redirect('/users/dashboardRec');
      }
      if (req.user.role === 'candidate') {
        res.redirect('/users/dashboardCand');
      }
    });

// app.post("/users/login", passport.authenticate('local'), 
// {

// function(req, res) {

//     let { role, email, password } = res.body;
//     console.log("role is:", res.body);

//         successRedirect: "/users/dashboard",
//         failureRedirect: "/users/login",
//         failureFlash: true
//       })
//     }
//     );
    // If this function gets called, authentication was successful.
    // `req.user` contains the authenticated user.

   // res.redirect('/users/' + req.user.username);
  //  successRedirect: '/users/dashboard',
  //  failureRedirect: '/users/login',
  //  failureFlash: true


function checkAuthenticated(req, res, next){
    if(req.isAuthenticated()){
        return res.redirect('/users/dashboard');
    }
    next();
}

function checkNotAuthenticated(req, res, next){
    if(req.isAuthenticated()){
        return next();
    }
    res.redirect('/users/login');
}

app.listen(PORT, ()=>{
    console.log(`Server running on port: ${ PORT }`);
});

