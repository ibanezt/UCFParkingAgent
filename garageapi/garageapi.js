/*/
 *
 * Garage REST API
 * REST API that responds with data from garage_db
 *
/*/ 
 
//InfluxDB Library
const Influx = require('influx');

//Environment Variable Import
const dotenv = require('dotenv');
dotenv.config({path:'/opt/www/garageapi/.env'});

const express = require('express');

//Influx Connection
const garageDB = new Influx.InfluxDB({
	host: 'localhost',
	port: 8086,
	username: process.env.DB_USER,
	password: process.env.DB_PASS,
	database: 'garage_db',
	schema: [
		{
			measurement: 'load',
			tags: [
				'garage',
				'weekday',
				'hour',
				'minute'
			],
			fields: {
				available: Influx.FieldType.INTEGER
			}
		}
	]
});

const app = express();

/** 
 * Garage Now API
 * @version 2
 * Gets current garage load, use 'All' to get all garages at once
*/

app.get('/api/v2/garage/:garage/now', function (req, res) {
	//Ask for Single Garage
	if (req.params.garage != 'All') {
		garageDB.query(`
			SELECT * FROM load
			WHERE garage=${Influx.escape.stringLit(req.params.garage)}
			ORDER BY time DESC
			LIMIT 1
		`).then(result => {
			//Prepare result for JSON
			let qResult = result[0];
			
			//Get rid of timestamp
			delete qResult.time;

			//Convert to JSON
			let qResultJSON = JSON.stringify(result[0]);
			//Log for debug
			console.log(qResultJSON);

			//Send JSON Response
			res.type('application/json');
			res.send(qResultJSON);
		}).catch(err => {
			res.status(500).send(err.stack);
		})
	}
	else {
		//Otherwise Asking for All Garages
		garageDB.query(`
			SELECT * FROM load
			ORDER BY time DESC
			LIMIT 7
		`).then(result => {
			//Prepare result for JSON
			for (let qResult of result) {
				//Get rid of timestamp
				delete qResult.time;
			}

			//Convert to JSON
			let qResultJSON = JSON.stringify(result);
			//Log for debug
			console.log(qResultJSON);

			//Send JSON Response
			res.type('application/json');
			res.send(qResultJSON);
		}).catch(err => {
			res.status(500).send(err.stack);
		})
	}
});

/**
 * Garage Prediction API
 * @version 2
 * Gets simple moving average of past 6 weeks for prediction
 */
app.get('/api/v2/garage/:garage/prediction/:weekday/:hour/:minute', function (req, res) {
	
	garageDB.query(`
		SELECT MOVING_AVERAGE("available", 6) FROM load
		WHERE garage=${Influx.escape.stringLit(req.params.garage)}
		AND weekday=${Influx.escape.stringLit(req.params.weekday)}
		AND hour=${Influx.escape.stringLit(req.params.hour)}
		AND minute=${Influx.escape.stringLit(req.params.minute)}
		ORDER BY time DESC
		LIMIT 1
	`).then(result => {
		//Prepare result for JSON
		qResult = result[0];

		//Get rid of timestamp
		delete qResult.time;

		//Add query parameters
		qResult.garage = req.params.garage;
		qResult.weekday = req.params.weekday;
		qResult.hour = req.params.hour;
		qResult.minute = req.params.minute;

		//Rename moving_average to available to match other APIs
		qResult.available = qResult.moving_average;
		delete qResult.moving_average;

		//Round down available
		qResult.available = Math.floor(qResult.available);

		//Convert to JSON
		qResultJSON = JSON.stringify(result[0]);
		//Log for debug
		console.log(qResultJSON);

		//Send JSON response
		res.type('application/json');
		res.send(qResultJSON);

	}).catch(err => {
		res.status(500).send(err.stack);
	})
});

//Listen on port
app.listen(8080, () => {
	console.log("Server Running on Port 8080");
});


