var firebaseConfig = {
  apiKey: "AIzaSyD8F4wTTOruQQ54QurxsiPtzPmreUerrEo",
  authDomain: "little-brother-55371.firebaseapp.com",
  databaseURL: "https://little-brother-55371.firebaseio.com",
  projectId: "little-brother-55371",
  storageBucket: "little-brother-55371.appspot.com",
  messagingSenderId: "313102563105",
  appId: "1:313102563105:web:136fc08996652b6b9ef060",
  measurementId: "G-76ESB0C0N3"
};

const functions = require('firebase-functions');
const bodyParser = require('body-parser')//add this
const admin = require('firebase-admin');
const express = require('express');
const cookieParser = require('cookie-parser')();
const cors = require('cors')({origin: true});
const app = express();

admin.initializeApp(firebaseConfig);


// Express middleware that validates Firebase ID Tokens passed in the Authorization HTTP header.
// The Firebase ID token needs to be passed as a Bearer token in the Authorization HTTP header like this:
// `Authorization: Bearer <Firebase ID Token>`.
// when decoded successfully, the ID Token content will be added as `req.user`.
const validateFirebaseIdToken = async (req, res, next) => {
  console.log(req.url)

  console.log('Check if request is authorized with Firebase ID token');

  if ((!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) &&
      !(req.cookies && req.cookies.__session)) {
    console.error('No Firebase ID token was passed as a Bearer token in the Authorization header.',
        'Make sure you authorize your request by providing the following HTTP header:',
        'Authorization: Bearer <Firebase ID Token>',
        'or by passing a "__session" cookie.');
    res.status(403).send('Unauthorized');
    return;
  }

  let idToken;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    console.log('Found "Authorization" header');
    // Read the ID Token from the Authorization header.
    idToken = req.headers.authorization.split('Bearer ')[1];
  } else if(req.cookies) {
    console.log('Found "__session" cookie');
    // Read the ID Token from cookie.
    idToken = req.cookies.__session;
  } else {
    // No cookie
    res.status(403).send('Unauthorized');
    return;
  }

  try {
    const decodedIdToken = await admin.auth().verifyIdToken(idToken);
    console.log(decodedIdToken);
    req.user = decodedIdToken;
    next();
    return;
  } catch (error) {
    console.error('Error while verifying Firebase ID token:', error);
    res.status(403).send('Unauthorized');
    return;
  }
};
//middleware
app.use(bodyParser.json(strict=false))
app.use(cors);
app.use(cookieParser);
app.use(validateFirebaseIdToken);

app.get('/', (req, res) => {
  res.send(null);
});

//list of all camera
app.get('/camera/big', (req, res) => {
  admin.database().ref("camera").orderByChild("bigBrotherId").equalTo(req.user.user_id).once('value').then(function(dataSnapShot){
    res.send(dataSnapShot)
  });
});

app.get('/camera/little', (req, res) => {
  admin.database().ref("camera").orderByChild("littleBrotherId").equalTo(req.user.user_id).once('value').then(function(dataSnapShot){
    res.send(dataSnapShot)
  });
});

app.post('/camera', (req, res) => {
  admin.auth().getUserByEmail(req.body.littleBrother).then(function(userRecord){
    console.log("uid lb: ", userRecord.uid)
    req.body.littleBrotherId = userRecord.uid,
    req.body.bigBrotherId = req.user.user_id,
    req.body.accept = false
    cam = admin.database().ref('camera').push(req.body)
    admin.database().ref("camera/" + cam.key).update({
      "id": cam.key
    })
    admin.database().ref("user/" + req.body.littleBrotherId).once("value").then((snapshot) => {
      var response = req.body.bigBrother+ "vous a envoyer une demande de camera"
      var message = {
        token: snapshot.child("fcm").val(),
        notification: {
        title: "Alerte littleBrother",
            body: response,
          }, data: {
              channel_id: "Notification_1"
            }
          }
      admin.messaging().send(message).then((response) => {
        console.log("message sent")
      }).catch((error) => {
        console.log("errror "+ error)
      })
    })
    res.send("cam added with uid: "+ cam.key)
  }).catch(function(error) {
    console.log('Error fetching user data:', error);
    res.send("error in adding cam")
  });
});

app.delete('/camera/:id', (req, res) => {
  admin.database().ref("camera/"+req.params.id).once('value').then(function(dataSnapShot){
    if (dataSnapShot.child("littleBrotherId").val() == req.user.user_id || dataSnapShot.child("bigBrotherId").val() == req.user.user_id){
      admin.database().ref("camera/"+req.params.id).remove()
      res.send("camera deleted")
    }
  }).catch(function(error){
    res.send("error")
  });
});

app.put('/camera/:id', (req, res) => {
  admin.database().ref("camera/"+req.params.id).once('value').then(function(dataSnapShot){
    if (dataSnapShot.child("littleBrotherId").val() == req.user.user_id){
      admin.database().ref("camera/"+req.params.id).update({"accept": true})
      res.send("camera accepted")
    }
  }).catch(function(error){
    res.send("error")
  });
});

// --- USER --- //
app.get("/user", (req, res) => {
  admin.database().ref("user").once('value').then(function(dataSnapShot){
    res.send(dataSnapShot)
  });
});

app.post("/user", (req, res) => {
  admin.database().ref('user/'+ req.user.user_id).set({"fcm": req.body});
  res.send("fcm token succesfully changed/addedx");
});

// --- NOTIFICATION --- //
app.post("/logs", (req, res) => {
  if (req.query.entr)
    var enterStr = "entrée"
  else
    var enterStr = "sortie"
  var timestamp = new Date()
  var date = new Date(timestamp)
  admin.database().ref("logs/"+ req.body).push({"timestamp": Date.now(), "enter": req.query.enter})
  admin.database().ref("camera/"+req.body).once("value").then((dataSnapshot) => { 
    admin.database().ref("user/" + dataSnapshot.child("bigBrotherId").val()).once("value").then(function(snapShot){
      var response = dataSnapshot.child("littleBrother").val() + " est " + enterStr+ " dans la zone \"" + dataSnapshot.child("name").val() + "\" à " + date.toUTCString().replace("T", " ").replace("Z", " ") + "."
      var message = {
        token: snapShot.child("fcm").val(),
        notification: {
          title: "Alerte littleBrother",
          body: response,
        }, data: {
            channel_id: "Notification_1"
          }
        }
      admin.messaging().send(message).then((response) => {
        console.log("message sent")
        res.send("message sent");
      }).catch((error) => {
        console.log("errror "+ error)
        res.send("error");
      })
    })  
  })
})

// This HTTPS endpoint can only be accessed by your Firebase Users.
// Requests need to be authorized by providing an `Authorization` HTTP header
// with value `Bearer <Firebase ID Token>`.
exports.app = functions.region('europe-west1').https.onRequest(app);  