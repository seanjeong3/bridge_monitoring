'use strict';

/* To start the webserver run the command: 
 *
 *    node webServer.js
 *    nodemon webServer.js
 *
 * Note that anyone able to connect to localhost:3001 will be able to fetch any file accessible
 * to the current user in the current directory or any of its children.
 */



/*
 * ************************************************************
 * Define parameters
 * ************************************************************
 */
var isAuthRequired = false;
var serverIP = 'localhost';
var portno = 3000;
var cassIP = ['0.0.0.0:9042'];
var cassKeyspace = 'bridge_monitoring';



/*
 * ************************************************************
 * Import modules
 * ************************************************************
 */

 /*** Basic modules ***/
var session = require('express-session');
var express = require('express');
var PythonShell = require('python-shell');
var uuid = require('uuid');
var fs = require('fs');
var xml = require('xml');
var xml2js = require('xml2js');
var async = require('async');
var mime = require('mime');
var dateFormat = require('dateformat');

/*** Express module ***/
// We have the express static module (http://expressjs.com/en/starter/static-files.html) do all the work for us.
var app = express();
app.use(express.static(__dirname));
app.use(session({secret: 'secretKey', resave: false, saveUninitialized: false}));

/*** BodyParser modules ***/
var bodyParser = require('body-parser');
var jsonParser = bodyParser.json({limit:1024*1024*20, type:'application/json'});
var urlencodedParser = bodyParser.urlencoded({ extended:true,limit:1024*1024*20,type:'application/x-www-form-urlencoding' });
app.use(jsonParser);
app.use(urlencodedParser);

/*** Cassandra module ***/
var cassandra = require('cassandra-driver');
const authProvider = new cassandra.auth.PlainTextAuthProvider(process.argv[2], process.argv[3]);
const cassClient = new cassandra.Client({ contactPoints: cassIP, keyspace: cassKeyspace, authProvider: authProvider});



/*
 * ************************************************************
 * Run Server
 * ************************************************************
 */

var server = app.listen(portno, function () {
  var port = server.address().port;
  console.log('Listening at http://' + serverIP + ':' + port + ' exporting the directory ' + __dirname);
});



/*
 * ************************************************************
 * RESTful server-side data sources
 * ************************************************************
 */

app.get('/', function (request, response) {
    response.send('Simple web server of files from ' + __dirname);
});



/* 
 * --------------------
 * GET: /sensor_data
 * --------------------
 */ 
const sensordataIDQuery = ['event_time_begin','event_time_end'];
app.get('/sensor_data/:id', function (request, response) {
	// Authentication check
	if (isAuthRequired && request.session.user_id === undefined) {
        response.status(401).end();
        return;
    }

    // Record URL of the web service
	var url = request.protocol + '://' + request.get('host') + request.originalUrl;

	// Prepare an select query template
	var cassQueryStmt = 'SELECT sensor_id, event_time, data \
	                     FROM sensordata \
	                     WHERE ';
	var cassQueryVal = [];
	var queryCond = [];
	queryCond.push('sensor_id = ?');
	cassQueryVal.push(request.params.id);

	// Validate query condition
	for (k in sensordataIDQuery) {
		if (request.query.indexOf(k) <= -1) {
	        response.writeHead(400, {'Content-Type': 'text/plain'});
	        response.end('ERROR: Required query parameter is omitted (' + k + ')');
	        return;
		} 
	};
	for (var k in request.query) {
		if (sensordataIDQuery.indexOf(k) <= -1) {
	        response.writeHead(400, {'Content-Type': 'text/plain'});
	        response.end('ERROR: Unknown query parameter (' + k + ')');
	        return;
		} 
	};

	// Build query 
	var beginDate = new Date(Date.parse(request.query['event_time_begin']));
	var endDate = new Date(Date.parse(request.query['event_time_end']));
	queryCond.push('event_time >= ?');
	cassQueryVal.push(beginDate);
	queryCond.push('event_time <= ?');
	cassQueryVal.push(endDate);
    var years = [];
    for (var y = beginDate.getFullYear(); y <= endDate.getFullYear(); y++) {
        years.push(y.toString())
    };
	queryCond.push('year IN ?');
	cassQueryVal.push(years);
	cassQueryStmt += queryCond.join(' AND ');

	// Execute SELECT query
	var results = [];
	cassClient.execute(cassQueryStmt, cassQueryVal, function(err, result) {
		if (err) {
			console.log(err);
            response.status(400).send(JSON.stringify(err));
		} else {
			console.log("success: get /sensor_data");
			response.status(200).send(JSON.stringify({"content":result.rows, "links":[{"rel": "self","href": url}]}));
		}
		return;
	});
});



/*
 * --------------------
 * POST: /sensor_data
 * --------------------
 */ 
app.post('/sensordata', function (request, response) {   
	// Authentication check
	if (isAuthRequired && request.session.user_id === undefined) {
        response.status(401).end();
        return;
    }

	// Prepare an insert query template
	const query = 'INSERT INTO sensordata \
	               (sensor_id, year, event_time, data) \
	               values (?, ?, ?, ?)';

	// Parse incoming JSON data
	var body = JSON.parse(JSON.stringify(request.body));
	var queries = [];
	for (var i=0; i<body.length; i++) {
		var ts = new Date(Date.parse(body[i].event_time));
		var params = [body[i].sensor_id, (dateFormat(ts, "yyyy")), ts, body[i].data];
		queries.push({'query':query, 'params':params});
	};

	// Execute INSERT query 
	cassClient.batch(queries, { prepare: true }, function (err) {
   		if (err) {
   			console.log(err)
            response.status(400).end();
		} else {
			console.log("success: post /sensor_data");
			response.status(200).end();
		}
		return;
	});
});



/* 
 * --------------------
 * GET: /sensor_info
 * --------------------
 */ 
const sensorQuery = ['sensor_type', 'install_date', 'remove_date'];
app.get('/sensor_info', function (request, response) {
	// Authentication check
	if (isAuthRequired && request.session.user_id === undefined) {
        response.status(401).end();
        return;
    }

    // Record URL of the web service
	var url = request.protocol + '://' + request.get('host') + request.originalUrl;

	// Prepare an select query template
	var cassQueryStmt = 'SELECT * \
	                     FROM sensorinfo \
	                     WHERE ';
	var cassQueryVal = [];
	var queryCond = [];

	// Validate query condition
	for (var k in request.query) {
		if (sensorQuery.indexOf(k) <= -1) {
	        response.writeHead(400, {'Content-Type': 'text/plain'});
	        response.end('ERROR: Unknown query parameter (' + k + ')');
	        return;
		} else {
			// Push sensorType and install to the query statement
			if (k == 'sensor_type') {
				queryCond.push('sensor_type = ?');
				cassQueryVal.push(request.query[k]);
			} else if (k == 'install_date') {
				queryCond.push('install_date <= ?');
				cassQueryVal.push(new Date(Date.parse(request.query[k])));
			}
		}
	}

	// Push remove_date to the query statement. If there's no remove_date query input, use default 'NOW'.
	queryCond.push('remove >= ?');
	if ('remove' in request.query) {
		cassQueryVal.push(new Date(Date.parse(request.query['remove'])));	
	} else {
		cassQueryVal.push(new Date());
	}

	// Build query statement
	cassQueryStmt += queryCond.join(' AND ');
	cassQueryStmt += ' ALLOW FILTERING;';

	console.log(cassQueryStmt)

	// Execute query 
	cassClient.execute(cassQueryStmt, cassQueryVal, function(err, result) {
		if (err) {
			console.log(err);
            response.status(400).send(JSON.stringify(err));
		} else {
			console.log("success: get /sensor_info");
			response.status(200).send(JSON.stringify({"content":result.rows, "links":[{"rel": "self","href": url}]}));
		}
		return;
	});
});



/* 
 * --------------------
 * GET: /sensor_info/:id
 * --------------------
 */ 
const sensorIDQuery = ['property', 'install_date', 'remove_date'];
app.get('/sensor_info/:id', function (request, response) {
	// Authentication check
	if (isAuthRequired && request.session.user_id === undefined) {
        response.status(401).end();
        return;
    }

    // Record URL of the web service
	var url = request.protocol + '://' + request.get('host') + request.originalUrl;

	// Prepare an select query template
	var cassQueryStmt = 'SELECT ';
	if ('property' in request.query) {
		cassQueryStmt += request.query['property'];
	} else {
		cassQueryStmt += '*';
	};	

	cassQueryStmt += ' FROM sensor_info \
	                  WHERE ';
	var cassQueryVal = [];
	var queryCond = [];

	// Validate query condition
	for (var k in request.query) {
		if (sensorIDQuery.indexOf(k) <= -1) {
	        response.writeHead(400, {'Content-Type': 'text/plain'});
	        response.end('ERROR: Unknown query parameter (' + k + ')');
	        return;
		} else {
			// Push sensorType and install to the query statement
			if (k == 'install_date') {
				queryCond.push('install_date <= ?');
				cassQueryVal.push(new Date(Date.parse(request.query[k])));
			}
		}
	};

	// Push remove_date to the query statement. If there's no remove query input, use default 'NOW'.
	queryCond.push('remove_date >= ?');
	if ('remove_date' in request.query) {
		cassQueryVal.push(new Date(Date.parse(request.query['remove_date'])));	
	} else {
		cassQueryVal.push(new Date());
	}

	// Push sensor_id to the query statement
	queryCond.push('sensor_id = ?');
	cassQueryVal.push(request.params.id);

	// Build query statement
	cassQueryStmt += queryCond.join(' AND ');
	cassQueryStmt += ' ALLOW FILTERING;';

	// Execute query 
	cassClient.execute(cassQueryStmt, cassQueryVal, function(err, result) {
		if (err) {
			console.log(err);
            response.status(400).send(JSON.stringify(err));
		} else {
			console.log("success: get /sensor_info:id");
			response.status(200).send(JSON.stringify({"content":result.rows, "links":[{"rel": "self","href": url}]}));
		}
		return;
	});
});



/* 
 * --------------------
 * POST: /sensor_info
 * --------------------
 */ 
app.post('/sensor_info', function (request, response) {
	// Authentication check
	if (isAuthRequired && request.session.user_id === undefined) {
        response.status(401).end();
        return;
    }

	// Parse incoming JSON data
	var body = JSON.parse(JSON.stringify(request.body));
	var keys = [];
	var values = [];
	var questions = [];
	for (var k in body) {
		keys.push(k);
		if (k === "install_date" || k === "remove_date") {
			values.push(new Date(Date.parse(body[k])));
		} else {
			values.push(body[k]);
		}
		questions.push("?");
	};

	// Generate insert query statement
	var query = 'INSERT INTO sensorinfo (' + keys.join(', ') + ') values (' + questions.join(', ') + ')';
	cassClient.execute(query, values, function(err, result) {
		if (err) {
			console.log(err);
            response.status(400).end();
		} else {
			console.log("success: post /sensor_info");
			response.status(200).end();
		}
		return;
	});
});



/******* Below need test *******/

// /* 
//  * --------------------
//  * GET: /imagedata/:id
//  * --------------------
//  */ 

// const imagedataIDQuery = ['date','event_time_begin','event_time_end'];
// app.get('/imagedata/:id', function (request, response) {
// 	if (isAuthRequired && request.session.user_id === undefined) {
//         response.status(401).end();
//         return;
//     }

// 	var url = request.protocol + '://' + request.get('host') + request.originalUrl;

// 	var cassQueryStmt = 'SELECT camera_id, event_time, image FROM imagedata WHERE ';
// 	var cassQueryVal = [];
// 	var queryCond = [];
// 	queryCond.push('camera_id = ?');
// 	cassQueryVal.push(request.params.id);

// 	for (k in imagedataIDQuery) {
// 		if (k in request.query) {
// 	        response.writeHead(400, {'Content-Type': 'text/plain'});
// 	        response.end('ERROR: Required query is omitted (' + k + ')');
// 	        return;
// 		} 
// 	};

// 	// Check if there're unexpected query condition
// 	for (var k in request.query) {
// 		if (imagedataIDQuery.indexOf(k) <= -1) {
// 	        response.writeHead(400, {'Content-Type': 'text/plain'});
// 	        response.end('ERROR: Unknown query parameter (' + k + ')');
// 	        return;
// 		} 
// 	};

// 	var beginDate = new Date(Date.parse(request.query['event_time_begin']))
// 	var endDate = new Date(Date.parse(request.query['event_time_end']))

// 	queryCond.push('event_time >= ?');
// 	cassQueryVal.push(beginDate);
// 	queryCond.push('event_time <= ?');
// 	cassQueryVal.push(endDate);

// 	var month = [];
// 	var m = new Date(beginDate);
// 	m.setDate(1);

// 	while (m <= endDate) {
// 		month.push(dateFormat(m, "yyyymm"));
// 		m.setMonth(m.getMonth() + 1);
// 	};

// 	queryCond.push('month IN ?');
// 	cassQueryVal.push(month);

// 	// Build query statement
// 	cassQueryStmt += queryCond.join(' AND ');

// 	// Execute query 
// 	cassClient.execute(cassQueryStmt, cassQueryVal, function(err, result) {
// 		if (err) {
//             response.status(400).send(JSON.stringify(err));
// 		} else {
// 			console.log('Success (' + new Date() + '): GET /sensordata/:id [Query: ' + cassQueryStmt +']')
// 			response.status(200).send(JSON.stringify({"content":result.rows, "links":[{"rel": "self","href": url}]}));
// 		}
// 		return;
// 	});
// });



// /* 
//  * --------------------
//  * POST: /imagedata
//  * --------------------
//  */ 

// app.post('/imagedata', function (request, response) {   
// 	if (isAuthRequired && request.session.user_id === undefined) {
//         response.status(401).end();
//         return;
//     }

// 	var body = JSON.parse(JSON.stringify(request.body))
// 	const query = 'INSERT INTO imagedata (camera_id, month, event_time, image) values (?, ?, ?, ?)';
// 	var queries = [];
// 	for (var i=0; i<body.length; i++){
// 		var ts = new Date(Date.parse(body[i].event_time));
// 		var buf = new Buffer(body[i].data, 'base64');
// 		var params = [body[i].camera_id, dateFormat(ts, "yyyymm"), ts, buf];
// 		queries.push({'query':query, 'params':params});
// 	};

// 	cassClient.batch(queries, { prepare: true }, function (err) {
//    		if (err) {
//             response.status(400).end();
// 		} else {
// 			response.status(200).end();
// 		}
// 		return;
// 	});
// });



// /* 
//  * --------------------
//  * GET: /weatherdata
//  * --------------------
//  */ 
// const weatherdataIDQuery = ['event_time_begin','event_time_end'];
// app.get('/weatherdata/:state/:city', function (request, response) {
// 	if (isAuthRequired && request.session.user_id === undefined) {
//         response.status(401).end();
//         return;
//     }

// 	var url = request.protocol + '://' + request.get('host') + request.originalUrl;

// 	var cassQueryStmt = 'SELECT * FROM weatherdata WHERE ';
// 	var cassQueryVal = [];
// 	var queryCond = [];
// 	queryCond.push('state = ?');
// 	cassQueryVal.push(request.params.state);
// 	queryCond.push('city = ?');
// 	cassQueryVal.push(request.params.city);

// 	for (k in weatherdataIDQuery) {
// 		if (k in request.query) {
// 	        response.writeHead(400, {'Content-Type': 'text/plain'});
// 	        response.end('ERROR: Required query is omitted (' + k + ')');
// 	        return;
// 		} 
// 	};

// 	// Check if there're unexpected query condition
// 	for (var k in request.query) {
// 		if (weatherdataIDQuery.indexOf(k) <= -1) {
// 	        response.writeHead(400, {'Content-Type': 'text/plain'});
// 	        response.end('ERROR: Unknown query parameter (' + k + ')');
// 	        return;
// 		} 
// 	};

// 	var beginDate = new Date(Date.parse(request.query['event_time_begin']));
// 	var endDate = new Date(Date.parse(request.query['event_time_end']));

// 	queryCond.push('event_time >= ?');
// 	cassQueryVal.push(beginDate);
// 	queryCond.push('event_time <= ?');
// 	cassQueryVal.push(endDate);

// 	// Build query statement
// 	cassQueryStmt += queryCond.join(' AND ');

// 	console.log(cassQueryStmt)
// 	console.log(cassQueryVal)

// 	// Execute query 
// 	cassClient.execute(cassQueryStmt, cassQueryVal, function(err, result) {
// 		if (err) {
// 			console.log(err)
//             response.status(400).send(JSON.stringify(err));
// 		} else {
// 			response.status(200).send(JSON.stringify({"content":result.rows, "links":[{"rel": "self","href": url}]}));
// 		}
// 		return;
// 	});
// });



// /*
//  * --------------------
//  * POST: /weatherdata
//  * --------------------
//  */ 
// app.post('/weatherdata', function (request, response) {   
// 	/* AUTH */
// 	if (isAuthRequired && request.session.user_id === undefined) {
//         response.status(401).end();
//         return;
//     }
//     var body = JSON.parse(JSON.stringify(request.body));
// 	var queries = [];
// 	for (var i=0; i<body.length; i++){	
// 		var keys = [];
// 		var values = [];
// 		var questions = [];
// 		for (var k in body[i]) {
// 			keys.push(k)
// 			values.push(body[i][k])
// 			questions.push("?")
// 		};
// 		var query = 'INSERT INTO weatherdata (' + keys.join(', ') + ') values (' + questions.join(', ') + ')'
// 		queries.push({'query':query, 'params':values});
// 	}

// 	cassClient.batch(queries, { prepare: true }, function (err) {
//    		if (err) {
//    			console.log(err)
//             response.status(400).end();
// 		} else {
// 			response.status(200).end();
// 		}
// 		return;
// 	});
// });



// /* 
//  * --------------------
//  * POST: /admin/login
//  * --------------------
//  */ 
// app.post('/admin/login', function (request, response) {  
// 	const query = 'SELECT * FROM userlist WHERE user_id = ?';
// 	// Execute query 
// 	cassClient.execute(query, [request.body["user_id"]], function(err, result) {
// 		if (err) {
// 			console.log(err);
//             response.status(400).send(JSON.stringify(err));
// 		} else {
// 			if (result.rows.length === 0 ){
//         		response.status(400).send(JSON.stringify(err));
//             	return;
// 			};
// 			var userInfo = result.rows[0];
// 	        if (userInfo["password"] !== request.body.password) {
// 			    response.status(400).send("Wrong Password");
// 			    return;
// 			}
// 			request.session.user_id = userInfo.user_id;
// 			request.session.first_name = userInfo.first_name;
// 			request.session.last_name = userInfo.last_name;
// 			response.status(200).end();
// 		}
// 		return;
// 	});
// });



// /* 
//  * --------------------
//  * POST: /admin/logout
//  * --------------------
//  */ 
// app.post('/admin/logout', function (request, response) {    
//     if (request.session.user_id === undefined) {
//         response.status(400).end();
//         return;
//     }
// 	delete request.session.user_id;
//     delete request.session.first_name;
//     delete request.session.last_name;
//     request.session.destroy(function(err) {
//         if (err) {
//             console.log(err);
//             response.status(400).send(JSON.stringify(err));
//             return;
//         }
//         response.status(200).end();
//     });   
// });






// /* *************
//  * GET: /femodel
//  * *************
//  */ 
// const femodelQuery = ['format'];
// const femodelFormat = ['xlsx', 'xml']
// app.get('/femodel/:id', function (request, response) {
// 	// var options = {mode: 'text', pythonOptions: ['-u'], args: []};
// 	for (var k in request.query) {
// 		if (femodelQuery.indexOf(k) <= -1) {
// 	        response.writeHead(400, {'Content-Type': 'text/plain'});
// 	        response.end('ERROR: Unknown query parameter (' + k + ')');
// 	        return;
// 		}
// 	}
// 	if ('format' in request.query) {
// 		if (femodelFormat.indexOf(request.query['format']) <= -1) {
// 	        response.writeHead(400, {'Content-Type': 'text/plain'});
// 	        response.end('ERROR: Unknown format type (' + request.query['format'] + ')');
// 	        return;			
// 		}
// 	}
// 	if (request.params.id != 'trb') {
//         response.writeHead(400, {'Content-Type': 'text/plain'});
//         response.end('ERROR: Unknown bridge id (' + request.params.id + ')');
//         return;
// 	}
// 	PythonShell.run('brim_lib/cass_to_brimfem.py', function (err, result) {
// 		if (err) {
// 			response.status(400).send(JSON.stringify(err));
// 		} else {
// 			if (!('format' in request.query)) {
// 				console.log('Success (' + new Date() + '): GET /femodel [Run Python Script: brim_lib/cass_to_brimfem.py]')
// 				response.status(200).sendfile(result[0]);
// 			} else {
// 				if (request.query['format'] == 'xml') {
// 					console.log('Success (' + new Date() + '): GET /femodel [Run Python Script: brim_lib/cass_to_brimfem.py]')
// 					response.status(200).sendfile(result[0]);
// 				} else {
// 					PythonShell.run('brim_lib/brimfem_to_csi.py', function (err, result) {
// 						if (err) {
// 							response.status(400).send(JSON.stringify(err));
// 						} else {
// 							var filename = result[0];
//   							var mimetype = mime.lookup(filename);
//   							response.setHeader('Content-disposition', 'attachment; filename=' + filename);
//   							response.setHeader('Content-type', mimetype);
//   							// var filestream = fs.createReadStream(filename);
//   							// filestream.pipe(response);
// 							console.log('Success (' + new Date() + '): GET /femodel [Run Python Script: brim_lib/brimfem_to_csi.py]')
// 							response.status(200).sendfile(result[0]);
// 						}
// 					});
// 				}
// 			}
// 		}
// 		return;
// 	});
// });

// /* ********************
//  * GET: /geometricmodel
//  * ********************
//  */ 
// const geometricmodelQuery = [];
// app.get('/geometricmodel/:id', function (request, response) {
// 	// var options = {mode: 'text', pythonOptions: ['-u'], args: []};
// 	for (var k in request.query) {
// 		if (geometricmodelQuery.indexOf(k) <= -1) {
// 	        response.writeHead(400, {'Content-Type': 'text/plain'});
// 	        response.end('ERROR: Unknown query parameter (' + k + ')');
// 	        return;
// 		}
// 	}
// 	if (request.params.id != 'trb') {
//         response.writeHead(400, {'Content-Type': 'text/plain'});
//         response.end('ERROR: Unknown bridge id (' + request.params.id + ')');
//         return;
// 	}
// 	PythonShell.run('brim_lib/cass_to_brimgeo.py', function (err, result) {
// 		if (err) {
// 			response.status(400).send(JSON.stringify(err));
// 		} else {
// 			console.log('Success (' + new Date() + '): GET /geometricmodel [Run Python Script: brim_lib/cass_to_brimgeo.py]')
// 			response.status(200).sendfile(result[0]);
// 		}
// 		return;
// 	});
// });


// /* **********
//  * GET: /wadl
//  * **********
//  */ 
// app.get('/wadl', function (request, response) {
// 	for (var k in request.query) {
// 		if (geometricmodelQuery.indexOf(k) <= -1) {
// 	        response.writeHead(400, {'Content-Type': 'text/plain'});
// 	        response.end('ERROR: Unknown query parameter (' + k + ')');
// 	        return;
// 		}
// 	}
// 	console.log('Success (' + new Date() + '): GET /wadl ')
// 	response.status(200).sendfile('wadl/application.wadl');
// 	return;
// });

