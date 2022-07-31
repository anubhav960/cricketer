require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const encrypt = require('mongoose-encryption')
const session = require('express-session')

const app = express()
const cookieExpirationDate = new Date();
const cookieExpirationDays = 1;
cookieExpirationDate.setDate(cookieExpirationDate.getDate() + cookieExpirationDays);
app.use(session({
    secret: process.env.APPSECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        httpOnly : true,
        expires: cookieExpirationDate
    }
}));


app.set('view engine', 'ejs')
app.use(bodyParser.urlencoded({extended: true}))
app.use(express.static('public'))

mongoose.connect('mongodb+srv://qwertyuiop:qwertyuiop@cluster0.t3phd.mongodb.net/tournamentScheduler', {useNewUrlParser: true})

const adminSchema = new mongoose.Schema ({
    username: String,
    password: String
}) 

const secret = process.env.APPSECRET
adminSchema.plugin(encrypt, {secret: secret, encryptedFields: ['password']} )


const Admin = new mongoose.model('admin', adminSchema)

const newAdmin = new Admin({
    username: process.env.APPUSERNAME,
    password: process.env.APPPASSWORD
})

Admin.findOne({username: newAdmin.username}, (err,data) => {
    if(!data) {
        newAdmin.save((err) => {
            if(err) {
                console.log(err)
            }
            else {
                console.log('Successfully added admin')
            }
        })
    }
})




const tournamentsSchema = {
    tournamentName: String,
    teams: [
        {
            teamName: String
        }
    ],
    matches: [
        {
            team1: String,
            team2: String,
            date: Date,
            format: String,
            winner: String,
            tossWinner: String,
            tossDecision: Boolean,  
            score:
                {
                team1Runs: Number,
                team2Runs: Number,
                team1Wickets: Number,
                team2Wickets: Number,
                team1Overs: Number,
                team2Overs: Number
                }
        }
    ]
}

const Tournament = mongoose.model('Tournament', tournamentsSchema)

app.use((req,res,next) => {
    console.log(req.session.username);
    next();
});


app.get('/login', (req,res) => {
    res.render(__dirname + '/views/adminLogin.ejs')
})

app.post('/login', (req,res) => {
    const inputUsername = req.body.username
    const inputPassword = req.body.password
    Admin.findOne({username: inputUsername}, (err,foundUser) => {
        if(err) {
            res.send(err)
            req.session.isAdmin = false;
        }
        else {
            if(foundUser) {
                req.session.isAdmin = foundUser.username === process.env.APPUSERNAME;

                console.log(req.session);
                if(foundUser.password === inputPassword) {
                    console.log('passwords match')
                    res.redirect('/tournamentDisplay')
                }else{
                    req.session.isAdmin = false;
                    res.send("Wrong id or password")

                }
            }
            else {
                req.session.isAdmin = false;
                res.send("Wrong id or password")
            }
        }
    })
})

app.get('/addTournament', (req,res) => {
    if(req.session.isAdmin === true){
        res.render(__dirname + '/views/addTournament.ejs')
    }else{
        res.send("Illegal access.");
    }
})

app.post('/addTournament', (req,res) => {
    const tournamentName = req.body.newTournament
    const tournament = new Tournament({
        tournamentName: tournamentName
    })
    tournament.save()
    
    res.redirect('/tournamentDisplay')
})

app.post('/deleteTournament/:tName', (req,res) => {
    Tournament.deleteOne({tournamentName: req.params.tName}, (err,res) => {
        if(err) {
            console.log(err)
        }
        else {
            console.log(res)
        }
    })
    res.redirect('/tournamentDisplay')
})

app.post('/deleteTeam/:tName', (req, res) => {
    Tournament.updateOne({tournamentName: req.params.tName},{
        $pull: {
            teams: { teamName : req.body.teamName }
        }
    },function (err, val) {
        console.log(val,err)
    });
    res.redirect('/teamsDisplay/' + req.params.tName)
})
   
app.post('/deleteMatch/:tName', (req,res) => {
    Tournament.findOneAndUpdate({tournamentName: req.params.tName}, {
        $pull: {
            matches: {_id: req.body.matchId}
        }
    },
    { safe: true }
    , function(err,val) {
        console.log(err,val)
    })
    res.redirect('/matchesDisplay/' + req.params.tName)
})

app.get('/tournamentDisplay', (req,res) => {
    if(req.session.isAdmin===true) {
        Tournament.find({},{tournamentName: 1, _id: 0}, (err,tournamentList) => {
            res.render('tournamentDisplay', {listItems: tournamentList})
        })
    }
    else {
        res.send('Illegal access.')
    }
})

app.get('/addTeam/:tName', (req,res) => {
    if(req.session.isAdmin === true) {
        res.render('addTeam', {tournamentName: req.params.tName})
    }
    else {
        res.send("Illegal access.")
    }
})

app.post('/addTeam', (req,res) => {
    const teamName ={'teamName': req.body.newTeam}
    Tournament.findOneAndUpdate({tournamentName: req.body.tName}, {$push: {teams: teamName}}, (err, info) => {
        if(err) {
            console.log(err)
        }
        else {
            console.log(info)
        }
    })
    console.log(req.body)
    res.redirect('/teamsDisplay/' + req.body.tName)
})

app.get('/teamsDisplay/:tName', (req,res) => {
    if(req.session.isAdmin === true) {
        Tournament.findOne({tournamentName: req.params.tName},{_id:0, teams: 1}, (err, teamList) => {
            res.render('teamsDisplay', {listItems: teamList, tournamentName: req.params.tName})
        })
    }
    else {
        res.send("Illegal access.")
    }
})

app.get('/addMatch/:tName', (req,res) => {
    if(req.session.isAdmin === true) {
        Tournament.findOne({tournamentName: req.params.tName},{teams: 1, _id: 0}, (err,teamList) => {
            res.render('addMatch', {listItems: teamList, tournamentName: req.params.tName})
        })
    }
    else {
        res.send("Illegal access.")
    }
})

app.post('/addMatch/:tName', (req,res) => {
    const match = {
        'team1': req.body.team1,
        'team2': req.body.team2,
        'date': req.body.date,
        'format': req.body.format
    }
    Tournament.findOneAndUpdate({tournamentName: req.params.tName}, {
        $push: {
            matches: match
        }
        }, (err,info) => {
            if(err) {
                console.log(err)
            }
            else {
                console.log(info)
            }
    })
    res.redirect('/matchesDisplay/'+req.params.tName)
})

app.get('/matchesDisplay/:tName', (req,res) => {
    if(req.session.isAdmin === true) {
        Tournament.findOne({tournamentName: req.params.tName},{_id:0, matches: 1}, (err,matchList) => {
            res.render('matchesDisplay', {listItems: matchList, tournamentName: req.params.tName})
        })
    }
    else {
        res.send("Illegal access.")
    }
    
})

app.get('/dashboard/:tName', (req,res) => {
    if(req.session.isAdmin === true) {
        res.render('dashboard', {tournamentName: req.params.tName})
    }
    else {
        res.send("Illegal access.")
    }
})

app.get('/scoreUpdate/:tName/:match', (req,res) => {
    if(req.session.isAdmin === true) {
        Tournament.findOne({tournamentName: req.params.tName}, (err, data) => {
            res.render('scoreUpdate', {tournamentName: req.params.tName, listItems: data.matches[req.params.match], index:req.params.match})
        })
    }
    else {
        res.send("Illegal access.")
    }
})

app.post('/scoreUpdate', async (req,res) => {
    let data = await Tournament.findOne({tournamentName: req.body.tournamentName})
    let match = parseInt(req.body.match)
    data.matches[match].score.team1Runs = req.body.team1Score
    data.matches[match].score.team2Runs = req.body.team2Score
    data.matches[match].score.team1Overs = req.body.team1Overs
    data.matches[match].score.team2Overs = req.body.team2Overs
    data.matches[match].score.team1Wickets = req.body.team1Wickets
    data.matches[match].score.team2Wickets = req.body.team2Wickets
    await data.save()
    res.redirect('/matchesDisplay/'+ req.body.tournamentName)
})





app.listen(process.env.PORT, () => {
    console.log("Listening on port 3000")
})




app.get('/', (req,res) => {
    res.redirect('/userHome')
})

app.get('/userHome', (req,res) => {
    Tournament.find({},{tournamentName: 1, _id: 0}, (err,tournamentList) => {
        res.render('userHome', {listItems: tournamentList})
    })
})

app.get('/userDashboard/:tName', (req,res) => {
    res.render('userDashboard', {tournamentName: req.params.tName})
})

app.get('/userTeamsDisplay/:tName', (req,res) => {
    Tournament.findOne({tournamentName: req.params.tName},{_id:0, teams: 1}, (err, teamList) => {
        res.render('userTeamsDisplay', {listItems: teamList, tournamentName: req.params.tName})
    })
})

app.get('/userMatchesDisplay/:tName', (req,res) => {
    Tournament.findOne({tournamentName: req.params.tName},{_id:0, matches: 1}, (err,matchList) => {
        res.render('userMatchesDisplay', {listItems: matchList, tournamentName: req.params.tName})
    })
})

app.get('/scoreDisplay/:tName/:match', (req,res) => {
    Tournament.findOne({tournamentName: req.params.tName}, (err, data) => {
        res.render('scoreDisplay', {tournamentName: req.params.tName, listItems: data.matches[req.params.match]})
    })
})




app.post('/logout', (req,res) => {
    req.session.isAdmin = false
    Tournament.find({},{tournamentName: 1, _id: 0}, (err,tournamentList) => {
        res.render('userHome', {listItems: tournamentList})
    })
})

