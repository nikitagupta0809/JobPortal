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

const PORT = process.env.PORT || 4000; // uses process.env.port in production mode and 4000 in developer mode.
app.use(express.static('public'));

//middle ware: ejs
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false })); //send details from front end 
app.use(session({
    secret: 'secret', // does encryption
    resave: false,    // save information ?
    saveUninitialized: false //save session details ? 
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

app.get('/users/dashboardRec/jobapplicants', checkNotAuthenticated, (req, res)=>{
    res.render('jobapplicants', {user: req.user.email, role: req.user.role});
});

app.get('/users/dashboardCand/apply', checkNotAuthenticated, (req, res)=>{
    res.render('apply', {user: req.user.email, role: req.user.role});
});

app.get('/users/dashboardCand/applied', checkNotAuthenticated, (req, res) =>{
    res.render('apply', {user: req.user.email, role: req.user.role});
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

//posting a job 
app.post('/users/dashboardRec', async (req, res) => {
    let { jobid, jobname, jobdescr } = req.body;
    let recruiter = req.user.email;
    console.log("reecruiter: "+recruiter);
    console.log({
        jobid,
        jobname,
        jobdescr
    });

    //inserting into db if the job id does not exist in the db
    pool.query(
        `SELECT * FROM job WHERE jobid = $1`, [jobid], (err, results)=>{
            if(err){
                throw err
            }

            if(results.rows.length > 0){
              //  errors.push({ message: "Job ID alreadys exists!"})
                console.log('Job Id already exists in database!')
                res.render('dashboardRec')
            }
            else{
                console.log("inserting into db")
                pool.query(
                    `INSERT INTO job (jobid, name, description, recruiter) values ($1, $2, $3, $4)`,
                     [jobid, jobname, jobdescr, recruiter ], (err, results)=>{
                        if(err){
                            throw err;
                        }
                        console.log(results.rows);
                        req.flash('success_msg', "You have successfully posted the job.");
                        res.redirect('/users/dashboardRec');
                    }
                )
            }
})
})

app.post('/users/dashboardRec/jobapplicants', async (req, res) => {
    let { jobid2 } = req.body;
    console.log({
        jobid2
    });

    // fetching results for the jobid 
    pool.query(
        `SELECT * FROM appliedto WHERE jobid = $1`, [jobid2], (err, results)=>{
            if(err){
                throw err
            }
            if(results.rows.length > 0){
                console.log('Job Id found!')
                let obj = results.rows;
                console.log(obj)
                res.render('jobapplicants', {obj : obj})
            }
            else{
                req.flash('success_msg', "No Applicants for this Job ID!");
                res.render('dashboardRec');
            }
        })
    })
app.post('/users/dashboardCand/apply', async (req, res) => {
    let { jobid, email } = req.body;
    console.log(
        "inside func", jobid, email
    );

    // fetching results for the jobid 
    pool.query(
        `SELECT * FROM job`, [], (err, results)=>{
            if(err){
                throw err
            }
            if(results.rows.length > 0){
                console.log('Jobs fetched!')
                let obj = results.rows;
                console.log(obj)
                res.render('apply', {obj : obj})
            }
            else{
                req.flash('success_msg', "No jobs found!");
                res.render('dashboardCand');
            }
        })
    })

//user applies to a job
app.post('/users/dashboardCand/applied', async (req, res) => {
    let { jobid, email } = req.body;
    console.log({
        jobid,
        email
    });

     //inserting into db if the job id does not exist in the db
    pool.query(
        `SELECT * FROM appliedto WHERE jobid = $1 and candidateid=$2`, [jobid, email], (err, results)=>{
            if(err){
                throw err
            }

            if(results.rows.length > 0){
                errors.push({ message: "Job ID alreadys exists!"})
                console.log('You have already applied to this job!')
                res.render('dashboardCand', { errors })
            }
            else{
                console.log("inserting into db")
                pool.query(
                    `INSERT INTO appliedto (jobid, candidateid) values ($1, $2)`,
                        [jobid, email ], (err, results)=>{
                        if(err){
                            throw err;
                        }
                        console.log(results.rows);
                        req.flash('success_msg', "You have successfully applied for the job.");
                        res.redirect('/users/dashboardCand');
                    }
                )
            }
})
})

function checkAuthenticated(req, res, next){
    if(req.isAuthenticated()){
        return res.redirect('/users/login');
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

