const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const shortid = require('shortid')
const cors = require('cors')

const mongoose = require('mongoose')
let Schema = mongoose.Schema;
mongoose.connect(process.env.MLAB_URI || 'mongodb://localhost/exercise-track' )

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

// For checking logs
// https://big-airedale.glitch.me/api/exercise/log?userId=8fVcyuqwz

const Human = new Schema({
  username: String,
  _id: String,
  count: Number,
  logs: [Object]
});

const Person = mongoose.model("Person", Human);


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});


//
//
// Create new users here
//
//
app.post("/api/exercise/new-user", (req, res) => {
  if (req.body.username == '' || req.body.username == null) {
    return res.send({error: "username can't be empty"});
  }
  
  let newPerson = new Person({
    username: req.body.username,
    _id: shortid.generate(),
    count: 0,
    logs: []
  });
  
  // Check if username is taken
  Person.findOne({username: newPerson.username}, (err, data) => {
    if (data == null) {
      const { username, _id } = newPerson;
      newPerson.save( err => {
        if (err) throw err;
      });
      // Only need to send id and username
      // once a new user is created
      res.send({
        _id,
        username
      });
    } else {
      // No duplicate usernames allowed
      return res.send({error: "username already taken"});
    }
  })
});

//
//
// Create new exercise for the user here and update
//
//
app.post("/api/exercise/add", (req, res) => {
  // userId is _id in Person model
  const { userId, description } = req.body;
  // No empty spaces but date
  if (userId === '' || description === '' || req.body.duration === '') {
    return res.send({error: "star fields must be filled"});
  }
  // duration must be an integer
  const duration = parseInt(req.body.duration);
  // Fancy date formatting (YYYY-MM-DD)
  const date = (req.body.date === '' || req.body.date === null) ? 
        (new Date()).toISOString().slice(0, 10) : new Date(req.body.date).toISOString().slice(0, 10);
  
  Person.findOne({_id: userId}, (err, data) => {
    // Does the user exist?
    if (data === null || err) {
      return res.send({error: "invalid user id"});
    }
    // Prepare data for updating
    const username = data.username;
    const newCount = data.count + 1;
    const logs = data.logs;
    const plan = {
      description,
      duration,
      date
    };
    // Update the current user's exercise log
    Person.findByIdAndUpdate({_id: userId}, {count: newCount, logs: [...logs, plan]}, (err, data) => {
      res.send({
        _id: userId,
        username,
        description,
        duration,
        date
      });
    });
  });
});

//
//
// Show all users
//
//
app.get("/api/exercise/users", (req, res) => {
  Person.find({}, (err, data) => {
    if (err) {
      return res.send({error: "An error occurred"});
    };
    let arr = [];
    data.forEach( item => {
      arr.push({ _id: item._id, username: item.username, __v: item.__v });
    });
    res.send(arr);
  });
});

//
//
// Show specific user info based on id and/or date provided
//
//
app.get("/api/exercise/log", (req, res) => {
  const { userId } = req.query;
  // If 'to' is not defined, the default value is set to 1
  // check below for function use in isBetweenDates
  const to = req.query.to === undefined ? 1 : req.query.to;
  // If 'from' is not defined, the default value is the start of computer time
  const from = req.query.from === undefined ? (new Date(0)).toISOString().slice(0, 10) : req.query.from;
  if (!userId) {
    return res.send("invalid user id");
  }
  Person.findOne({_id: userId}, (err, data) => {
    if (data === null) {
      return res.send({error: "invalid user id"});
    }
    
    // If 'limit' is set to 0, all data will be displayed from the db
    const limit = req.query.limit === undefined ? data.logs.length : req.query.limit;
    
    // Filter out those exercises that don't meet requirements
    const filteredLogs = data.logs.filter((item, index) => isBetweenDates(item.date, from, to) && index < limit);
    
    res.send({
      _id: userId,
      username: data.username,
      logs: filteredLogs
    });
  });
});

// For checking individual dates in the logs
function isBetweenDates(currDate, from, to) {
  if (to === 1 && new Date(from) - new Date(currDate) <= 0) {
    return true;
  } else if (new Date(to) - new Date(currDate) >= 0 && new Date(from) - new Date(currDate) <= 0) {
    return true;
  }
  return false;
}

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})

