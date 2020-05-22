const LocalStrategy = require('passport-local').Strategy;
const { pool } = require('./dbConfig');
const bcrypt = require('bcrypt');


function initialize(passport){
const authenticateUser = (email, password, done) => {
    pool.query(
        `SELECT * FROM login WHERE email = $1`, [email],(err, results)=>{
            if(err){
                throw err;
            }
            console.log(results.rows);
            if(results.rows.length > 0)
            {
                const user = results.rows[0];
                //checking password:
                bcrypt.compare(password, user.password, (err, isMatch)=>{
                    if(err){
                        throw err;
                    }
                    else if(isMatch){
                        return done(null, user);
                    }
                    else{
                        return done(null, false, { message: "Incorrect password!" })
                    }
                });
            }else{
                    //no user found
                    return done(null, false, { message : "User not registered!"})
                }
            }
        );
    };
    passport.use(new LocalStrategy({
        usernameField: "email",
        passwordField: "password"
        },
        authenticateUser
        )
    );

    passport.serializeUser((user, done)=> done(null, user.email));
    passport.deserializeUser((email, done)=>{
        pool.query(
            `SELECT * FROM login WHERE email = $1`, 
            [email], ( err, results) => {
                if(err){
                    throw err;
                }
                return done(null, results.rows[0]);
            }
        )
    })
}

module.exports = initialize;