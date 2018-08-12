//elevation inspiration  https://www.solwise.co.uk/wireless-elevationtool.html
// sun calc http://suncalc.net/
import jQuery from 'jquery';
import L from "leaflet";
import SunCalc from "suncalc";
import morgan from 'morgan';
import LatLon from "mt-latlon";


const spacetime = require('spacetime')
const geo = require('spacetime-geo')
//apply the plugin
spacetime.extend(geo)
/*
import 'spacetime';
import 'spacetime-geo'
//apply the plugin
spacetime.extend(spacetime-geo);*/

//import proxy from 'express-http-proxy';

import PouchDB from "pouchdb";
//import "leaflet.tilelayer.pouchdbcached";

import GeometryUtil from "leaflet-geometryutil";
import "leaflet-search"; //The place search
import "leaflet-openweathermap";
import "leaflet-tilelayer-colorpicker";
import 'leaflet-sidebar-v2';
import "Leaflet.MultiOptionsPolyline";
import "leaflet-fontawesome-markers";
import "leaflet.locatecontrol";
import "leaflet-compass/dist/leaflet-compass.src.js";
import "leaflet-providers";

// DONE : Move to full screen map?

import "font-awesome/css/font-awesome.css";
//import "bootstrap/dist/css/bootstrap.css";
import "leaflet/dist/leaflet.css";
import "leaflet-search/dist/leaflet-search.min.css";
import "leaflet-sidebar-v2/css/leaflet-sidebar.css";
import "leaflet-fontawesome-markers/L.Icon.FontAwesome.css";
import "leaflet.locatecontrol/dist/L.Control.Locate.mapbox.css";
import "leaflet-compass/dist/leaflet-compass.src.css";



//https://github.com/pouchdb/add-cors-to-couchdb

var bAuth = false;
var iTimer = 0;
var iBetweenTimer = 0;
var sShootingDirection = "towards";

var defaultLatLng = [53.38298, -1.46949];
var oEye = L.marker(defaultLatLng);
var oCamera = L.marker(defaultLatLng);
var oEnd = null;


//https://pouchdb.com/getting-started.html
//import PouchAuth from "pouchdb-authentication";
//PouchDB.plugin(PouchAuth);
//var local = new PouchDB('local_db');
//var db = new PouchDB('https://couchdb-c866ea.smileupps.com/', {skip_setup: true});

if (bAuth) {
    local.sync(db, {
        live: true,
        retry: true
    }).on('error', console.log.bind(console));

    //https://www.npmjs.com/package/pouchdb-authentication
    //https://github.com/pouchdb-community/pouchdb-authentication/blob/master/docs/api.md#dbsignupusername-password--options--callback
    //Just a demo signup call it will fail as there is already a user
    db.signUp('batman', 'brucewayne', function (err, response) {
        if (err) {
            console.log(err);
            if (err.name === 'conflict') {
                // "batman" already exists, choose another username
            } else if (err.name === 'forbidden') {
                // invalid username
            } else {
                // HTTP error, cosmic rays, etc.
            }
        }
    });

    //demo login
    db.logIn('batman', 'brucewayne', function (err, response) {
        if (err) {
            console.log(err);
            if (err.name === 'unauthorized' || err.name === 'forbidden') {
                // name or password incorrect
            } else {
                // cosmic rays, a meteor, etc.
            }
        }
    });
}

//https://jjwtay.github.io/Leaflet.draw-box/ target box  drawing
// TODOS
// TODO : save plans
// DONE : FOV from the start & end of green sections (done ith same colouring)
// DONE : FOV calcuations / tables here https://en.wikipedia.org/wiki/Angle_of_view#Sensor_size_effects_(%22crop_factor%22)
// TODO : Login/ Register
// TODO : Change height of view for drone photgraphy (a how high too fly for a view of ???)
// TODO : Droneflight safety data
// TODO : Flightplanning
// TODO : Offline first flight/shootoinig plan data (and map flight safety data storage ??)
// TODO : pouchdb and couchdb
// TODO : Site reece recording
// TODO : Will in work on phone / tablet
// TODO : cordova if it will
// BUG : Dragging seems to break the view line

/*Returns the opposite of the triangle defined by 
the Cameras sensor
the focal length of the lens
the distance */
function getCameraOpposite(sensorWidth, focalLength, distanceM) {
    var angle = Math.atan(sensorWidth / (2 * focalLength));
    var oppositeM = distanceM * Math.sin(angle);
    return oppositeM;
}

//draw cone representing field of view 
function drawCone(lFocus, lStart) {
    var fl = jQuery("#lensfl").val();
    if (fl == "none") {
        return true;
    }
    var focalLength = fl * (1 / 1000);
    var sensorWidth = jQuery("#camerasw").val() * (1 / 1000);

    var distanceM = lStart.distanceTo(lFocus);
    //var distanceM = GeometryUtil.distance(map, lStart, lFocus);
    var oppositeM = getCameraOpposite(sensorWidth, focalLength, distanceM);
    var heading = GeometryUtil.bearing(lStart, lFocus);
    oConeLayer.clearLayers();
    var aPointsL = drawViewLine(map, oConeLayer, [lStart, GeometryUtil.destination(lFocus, (heading + 90) % 360, oppositeM)], iSteps, iDistance, true);
    var aPointsR = drawViewLine(map, oConeLayer, [lStart, GeometryUtil.destination(lFocus, (heading - 90) % 360, oppositeM)], iSteps, iDistance, true);
}

//Return array/line from a point at a heading for a distance
function getDirectionalLine(aLineStart, angle, distance) {
    // get position of the sun (azimuth and altitude) at today's sunrise
    var p1 = new LatLon(aLineStart[0], aLineStart[1]);
    var p2 = p1.destinationPoint(angle, distance);
    // create a red polyline from an array of LatLng points
    var latlngs = [
    [aLineStart[0], aLineStart[1]],
    [p2.lat(), p2.lon()]
  ];
    return latlngs;
}


//Create map
var map = L.map('map', {
    zoomControl: false
}).setView([53.3494, -1.5664], 11);
var oLine;


function getHeightAtPoint(point, RGBLayer) {
    var a = null;
    a = RGBLayer.getColor(point);

    var h = NaN;
    if (a !== null)
        h = Math.round(-10000 + (((a[0] * 256 * 256) + (a[1] * 256) + a[2]) * 0.1));
    return h;
}

var RGB_Terrain = L.tileLayer.colorPicker(
    'https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw?access_token=pk.eyJ1Ijoic3RyZXRjaHlib3kiLCJhIjoiY2pmN3lieDgyMWtpcjJybzQyMDM1MXJ2aiJ9.d3ZCRlRRBklHjvuhHGtmtQ', {
        maxZoom: 15,
        useCache: true,
        attribution: '&copy; <a href="https://mapbox.com/">mapbox</a>',
    }).addTo(map);

var RGB_Terrain2 = L.tileLayer.colorPicker(
    'https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw?access_token=pk.eyJ1Ijoic3RyZXRjaHlib3kiLCJhIjoiY2pmN3lieDgyMWtpcjJybzQyMDM1MXJ2aiJ9.d3ZCRlRRBklHjvuhHGtmtQ', {
        maxZoom: 15,
        useCache: true,
        attribution: '&copy; <a href="https://mapbox.com/">mapbox</a>',
        opacity:0.5
    });


/* http://leaflet-extras.github.io/leaflet-providers/preview/index.html */
var OpenStreetMap_Mapnik = L.tileLayer.provider('OpenStreetMap.Mapnik').addTo(map);
var MtbMap = L.tileLayer.provider('MtbMap');
var StamenTerrain = L.tileLayer.provider('Stamen.Terrain'); //.addTo(map);
var OpenTopoMap = L.tileLayer.provider('OpenTopoMap');


var OWM_APPID = "448c266078b9dbbd59af7d77257e11be";
var clouds = L.OWM.clouds({
    showLegend: false,
    opacity: 0.5,
    appId: OWM_APPID
});
var wind = L.OWM.wind({
    opacity: 0.5,
    appId: OWM_APPID
});
var rain = L.OWM.rain({
    opacity: 0.5,
    appId: OWM_APPID
});
var temp = L.OWM.temperature({
    opacity: 0.5,
    appId: OWM_APPID
});



var baseMaps = {
    "OSM Mapnik": OpenStreetMap_Mapnik,
    "Stamen Terrain": StamenTerrain,
    "MtbMap": MtbMap,
    "OpenTopoMap": OpenTopoMap,
};

var overlayMaps = {
    "RGB Heightmap": RGB_Terrain2,
    "Clouds": clouds,
    "Wind": wind,
    "Rain": rain,
    "Temp": temp
};

L.control.zoom({
    position: "topright"
}).addTo(map);

L.control.scale({
    position: "topright"
}).addTo(map);

function onLocationFound(e) {
    if (sShootingDirection == "towards") {
        oEye.setLatLng(e.latlng);
    } else {
        oCamera.setLatLng(e.latlng);
    }
}

map.on('locationfound', onLocationFound);

L.control.locate({
    position: "topright",
    keepCurrentZoomLevel: true,
    drawCircle: false,
    locateOptions: {
        watch: false
    }
}).addTo(map);

var layerControl = L.control.layers(baseMaps, overlayMaps, {
    position: "topright"
}).addTo(map);

//Add the address search 
map.addControl(new L.Control.Search({
    //layer: searchLayer,
    url: '//nominatim.openstreetmap.org/search?format=json&q={s}',
    jsonpParam: 'json_callback',
    propertyName: 'display_name',
    propertyLoc: ['lat', 'lon'],
    position: "topright",
    marker: L.circleMarker([0, 0], {
        radius: 30
    }),
    autoCollapse: true,
    autoType: false,
    minLength: 2,
    moveToLocation: function (latlng, title, oMap) {
        oMap.panTo(latlng);
        if (sShootingDirection == "towards") {
            oEye.setLatLng(latlng);
        }
        if (sShootingDirection == "from") {
            oCamera.setLatLng(latlng);
        }
        if (sShootingDirection == "between") {
            oEye.setLatLng(latlng);
            oCamera.setLatLng(latlng);
        }
        
    }
}));

map.addControl(new L.Control.Compass());

var oLineLayer = L.layerGroup().addTo(map);
var oConeLayer = L.layerGroup().addTo(map);

var sidebar = L.control.sidebar({
    autopan: false, // whether to maintain the centered map point when opening the sidebar
    closeButton: true, // whether t add a close button to the panes
    container: 'sidebar', // the DOM container or #ID of a predefined sidebar container that should be used
    position: 'left', // left or right
}).addTo(map);



function getPointsOnLine(map, aLine, steps) {
    var aList = [];
    for (var i = 0; i <= steps; i++) {
        var P1 = GeometryUtil.interpolateOnLine(map, aLine, i * (1 / steps));
        aList.push(P1.latLng);
    }
    return aList;
}

function getCameraHeight() {

    return parseFloat(jQuery("#cameraheight").val());
}

function drawViewLine(map, oLayer, aLine, iSteps, iDistance, bViewFrom) {
    if (bViewFrom == null) {
        bViewFrom = false;
    }

    var aPoints = [];
    if (bViewFrom) {
        aPoints = getViewFromLine(map, aLine, iSteps, iDistance);
    } else {
        aPoints = getViewTowardsLine(map, aLine, iSteps, iDistance);
    }
    oLine = L.multiOptionsPolyline(aPoints, {
        multiOptions: {
            optionIdxFn: function (latLng) {
                return latLng.ViewStatus;
            },
            options: [
                {
                    color: '#FF0000AA'
                }, {
                    color: '#0000FFAA'
                }, {
                    color: '#00FF00AA'
                }]
        },
        weight: 5,
        lineCap: 'butt',
        opacity: 0.75,
        smoothFactor: 1
    }).addTo(oLayer);

    return aPoints;
}

var bDebugOnce = false;

function getViewFromLine(map, aLine, iSteps, iDistance) {
    var cameraHeight = getCameraHeight();

    var aPoints = getPointsOnLine(map, aLine, iSteps);
    var fAngle = 0;
    var iFromAlt = null;
    var iStepDist = 1000 * (iDistance / iSteps);
    var fMaxAngle = -Math.PI / 2;
    var fMinAngle = Math.PI / 2;

    aPoints = aPoints.map(function (latLng, i) {
        latLng.alt = getHeightAtPoint(latLng, RGB_Terrain, true);
        var iDist = 0;
        var iTerrainHeight = 0;
        var fTerrainAngle = -Math.PI / 2;

        if (iFromAlt == null) {
            iFromAlt = latLng.alt + cameraHeight;
        } else {
            var iTerrainAlt = latLng.alt;
            iTerrainHeight = iTerrainAlt - iFromAlt;

            iDist = i * iStepDist;
            //SOHCAHTOA
            fTerrainAngle = Math.atan(iTerrainHeight / iDist);
        }

        latLng.iTerrainHeight = iTerrainHeight;
        latLng.iDist = iDist;
        latLng.fTerrainAngle = fTerrainAngle;

        var ViewStatus = VIEW_NONE;
        if (latLng.fTerrainAngle == fMaxAngle) {
            ViewStatus = VIEW_POSS;
        } else if (latLng.fTerrainAngle > fMaxAngle) {
            ViewStatus = VIEW_YES;
            fMaxAngle = latLng.fTerrainAngle;
        }

        latLng.ViewStatus = ViewStatus;
        return latLng;
    });
    return aPoints;
}


function getViewTowardsLine(map, aLine, iSteps, iDistance) {
    var cameraHeight = getCameraHeight();

    var aPoints = getPointsOnLine(map, aLine, iSteps);
    var fAngle = 0;
    var iTargetAlt = null;
    var iStepDist = 1000 * (iDistance / iSteps);
    var fMaxAngle = -Math.PI / 2;
    var fMinAngle = Math.PI / 2;
    var bViewFrom = false;


    aPoints = aPoints.map(function (latLng, i) {
        latLng.alt = getHeightAtPoint(latLng, RGB_Terrain, true);
        var iDist = 0;
        var iTerrainHeight = 0;
        var iCameraHeight = 0;
        var fTerrainAngle = -Math.PI / 2;
        var fCameraAngle = -Math.PI / 2;

        if (iTargetAlt == null) {
            iTargetAlt = latLng.alt;
        } else {
            var iTerrainAlt = latLng.alt;
            var iCameraAlt = latLng.alt;
            iCameraAlt += cameraHeight;

            iCameraHeight = iCameraAlt - iTargetAlt;
            iTerrainHeight = iTerrainAlt - iTargetAlt;

            iDist = i * iStepDist
            //SOHCAHTOA
            fCameraAngle = Math.atan(iCameraHeight / iDist);
            fTerrainAngle = Math.atan(iTerrainHeight / iDist);
        }

        latLng.iTerrainHeight = iTerrainHeight;
        latLng.iCameraHeight = iCameraHeight;
        latLng.iDist = iDist;
        latLng.fTerrainAngle = fTerrainAngle;
        latLng.fCameraAngle = fCameraAngle;

        if (latLng.fTerrainAngle > fMaxAngle) {
            fMaxAngle = latLng.fTerrainAngle;
        }

        var ViewStatus = VIEW_NONE;
        if (latLng.fCameraAngle == fMaxAngle) {
            ViewStatus = VIEW_POSS;
        } else if (latLng.fCameraAngle > fMaxAngle) {
            ViewStatus = VIEW_YES;
        }

        latLng.ViewStatus = ViewStatus;
        return latLng;
    });

    return aPoints;
}

var iDistance = 10;
var iSteps = 100;
const VIEW_NONE = 0;
const VIEW_POSS = 1;
const VIEW_YES = 2;

var _drawLine = function (sTimeType, sDate, sShootingDirection) {
    var oDate = new Date();
    if (sDate) {
        oDate = new Date(sDate);
    }
    var Target = oEye.getLatLng();
    if (sShootingDirection == "from") {
        Target = oCamera.getLatLng();
    }

    oLineLayer.clearLayers();
    oConeLayer.clearLayers();
    //var sTimeType = "sunrise";
    var target = [Target.lat, Target.lng];
    // TODO : Drawsunset as well
    var times = SunCalc.getTimes(oDate, target[0], target[1]);
    //nsole.log("times", times);
    jQuery("#time").html(times[sTimeType].toLocaleTimeString());


    var oPos = SunCalc.getPosition(times[sTimeType], target[0], target[1]);
    // get sunrise azimuth in degrees
    var fSunAngle = oPos.azimuth * 180 / Math.PI;
    var fCameraAngle = fSunAngle + 180;
    if (sShootingDirection == "from") {
        fSunAngle += 180;
    }

    var aLine = getDirectionalLine(target, fSunAngle, iDistance, "red");
    // TODO : put all this info in the sidebar

    var bViewFrom = (sShootingDirection == "from");
    // DONE : Draw graph or a heatline indicating where you should be able to see the target from
    var aPoints = drawViewLine(map, oLineLayer, aLine, iSteps, iDistance, bViewFrom);

    // TODO : Get google streetview of that point in the right direction
    // take filtered copy of aPoints where  l
    var aViews = aPoints.filter(function (latLng) {
        return latLng.ViewStatus == VIEW_YES;
    });

    //move camera
    var End = Target;
    End.iDist = 0;
    if (aViews.length) {
        End = aViews[aViews.length - 1];
    }
    if (sShootingDirection == "towards") {
        oCamera.setLatLng(End);
    } else if (sShootingDirection == "from") {
        oEye.setLatLng(End);
    }


    var template = require("!ejs-compiled-loader!./linesummary.ejs");
    var localTime = spacetime(times[sTimeType]).in(Target);
    var html = template({
        iDistance: End,
        fHeading: fCameraAngle,
        event: sTimeType,
        localTime: localTime
    });
    jQuery(".linesummary").html(html);

    if (sShootingDirection == "towards") {
        /* aViews.forEach(function (latLng) {
             drawCone(aPoints[0], latLng);
         });*/

        window.clearTimeout(iTimer);
        iTimer = window.setTimeout(function () {
            var fHeading = Math.round(fSunAngle + 180) % 360;
            var aRequests = aViews.map(requestStreetViews.bind(this, fHeading, Target));
        }, 100);
    } else {
        drawCone(oEye.getLatLng(), oCamera.getLatLng());

        window.clearTimeout(iTimer);
        iTimer = window.setTimeout(function () {
            requestStreetViews(fSunAngle, aLine[1], aLine[0], oCamera);
        }, 100);
    }

    // map that into requests to https://developers.google.com/maps/documentation/streetview/metadata
    // if there is an image available add a pop up (at the location it sends back) pointing back along the line
    return true;
}

var requestStreetViews = function (fHeading, lineEnd, latLng, oMarker) {
    var oParams = {
        key: process.env.GOOGLE_MAPS_API,
        location: "" + latLng.lat + "," + latLng.lng, //latitude/longitu
        size: "300x200",
        heading: fHeading,
        fov: 120,
        pitch: 0,
        radius: 50,
        source: "outdoor"
    };

    var sURL = "https://maps.googleapis.com/maps/api/streetview/metadata"; //?parameters
    return jQuery.getJSON(sURL, oParams,
        function (data, textStatus) {
            if (data.status == "OK") {
                var oTweaked = oParams;
                oTweaked.location = null;
                oTweaked.pano = data.pano_id;
                var sImg = "https://maps.googleapis.com/maps/api/streetview?" + jQuery.param(oTweaked);
                if (!oMarker) {
                    var oMarker = L.marker(data.location, {
                        icon: L.icon.fontAwesome({
                            iconClasses: 'fa fa-street-view', // you _could_ add other icon classes, not tested.
                            //markerColor: '#00a9ce',
                            markerColor: '#00cea9',
                            iconColor: '#FFF'
                        })
                    }).addTo(oLineLayer).on("click", function (evt) {
                        drawCone(lineEnd, latLng);
                    });
                }

                oMarker.bindPopup(L.popup({
                    minWidth: 300
                }).setContent(
                    '<a target="_blank" href="https://www.google.com/maps/@?api=1&map_action=pano&' +
                    jQuery.param(oTweaked) + '" >' +
                    "<img src=\"" + sImg + "\" ></a>"
                ));
            }
        });
}

var _drawBetween = function () {

    var aoLine = [oCamera.getLatLng(), oEye.getLatLng()];
    var aLine = aoLine.map(function (oPoint) {
        return [oPoint.lat, oPoint.lng];
    });
    var iDistance = aoLine[0].distanceTo(aoLine[1]);
    var fHeading = GeometryUtil.bearing(aoLine[0], aoLine[1]);



    var template = require("!ejs-compiled-loader!./betweensummary.ejs");
    var html = template({
        iDistance: iDistance,
        fHeading: fHeading
    });
    jQuery("#betweensummary").html(html);

    oLineLayer.clearLayers();

    var bViewFrom = true;
    var aPoints = drawViewLine(map, oLineLayer, aLine, iSteps, iDistance, bViewFrom);


    drawCone(aoLine[1], aoLine[0]);

    window.clearTimeout(iBetweenTimer);
    iBetweenTimer = window.setTimeout(function () {
        _findBetween();
    }, 100);


    /*
        window.clearTimeout(iTimer);
        iTimer = window.setTimeout(function () {
            requestStreetViews(fHeading,aLine[1], aLine[0], oCamera);
        }, 100);
    */


    // map that into requests to https://developers.google.com/maps/documentation/streetview/metadata
    // if there is an image available add a pop up (at the location it sends back) pointing back along the line
    return true;
}

var getSunAngle = function (time, target) {
    var oPos = SunCalc.getPosition(time, target[0], target[1]);
    // get sunrise azimuth in degrees
    return ((oPos.azimuth * 180 / Math.PI) - 180);
}

var _findBetween = function () {

    var aoLine = [oCamera.getLatLng(), oEye.getLatLng()];
    var fHeading = GeometryUtil.bearing(aoLine[0], aoLine[1]);

    var oDate = new Date();

    var Target = oCamera.getLatLng();
    Target.lon = Target.lng;
    var target = [Target.lat, Target.lng];
    var aSunEvents = [];

    for (var i = 0; i < 365; i++) {
        var newdate = new Date(oDate);
        newdate.setDate(newdate.getDate() + i);
        var times = SunCalc.getTimes(newdate, target[0], target[1]);
        //var sSunsetTime = times["sunrise"].toLocaleTimeString());
        //var sSunsetTime = times["sunset"].toLocaleTimeString());
        var fSunAngle = getSunAngle(times["sunrise"], target);
        var fDiff = Math.abs((fSunAngle - fHeading) % 360);


        var dSunRise = spacetime(times["sunrise"]).in(Target);

        var oSunRise = {
            i: i,
            event: "sunrise",
            date: newdate,
            time: times["sunrise"],
            sunangle: fSunAngle,
            localTime: dSunRise,
            diff: fDiff
        };
        aSunEvents.push(oSunRise);

        fSunAngle = getSunAngle(times["sunset"], target);
        var fDiff = Math.abs((fSunAngle - fHeading) % 360);
        //var dSunSet = tzgeo.tzMoment(Target.lat, Target.lng, times["sunset"]); // moment-timezone obj
        var dSunSet = spacetime(times["sunset"]).in(Target);
        var oSunSet = {
            i: i,
            event: "sunset",
            date: newdate,
            time: times["sunset"],
            sunangle: fSunAngle,
            localTime: dSunSet,
            diff: fDiff
        };
        aSunEvents.push(oSunSet);
    }

    aSunEvents = aSunEvents.filter(function (a) {
        return a.diff < 10;
    });

    aSunEvents.sort(function (a, b) {
        return a.diff - b.diff;
    });
    aSunEvents = aSunEvents.slice(0, 10);
    aSunEvents.sort(function (a, b) {
        return a.i - b.i;
    });

    renderSunTimes(aSunEvents);
    return true;
}

var renderSunTimes = function (aSunEvents) {
    var template = require("!ejs-compiled-loader!./sunpositions.ejs");
    var html = template({
        aSunEvents: aSunEvents
    });
    jQuery("#suntimes").html(html);
}

var drawLine = function () {
    if (sShootingDirection == "between") {
        return _drawBetween();
    }
    var sTimeType = jQuery("#timetype").val();
    var sDate = jQuery("#timedate").val();
    return _drawLine(sTimeType, sDate, sShootingDirection);
}

jQuery("#timedate").val(new Date());

setTimeout(function () {
    oEye = L.marker(defaultLatLng, {
        draggable: true,
        zIndexOffset: 1100,
        icon: L.icon.fontAwesome({
            //iconClasses: 'fa fa-camera', // you _could_ add other icon classes, not tested.
            iconClasses: 'fa fa-eye',
            markerColor: '#00a9ce',
            iconColor: '#FFF'
        })
    }).addTo(map);

    oEye.on("move", function (evt) {
        if (sShootingDirection == "from") {
            return true;
        }
        return drawLine();
    });

    oCamera = L.marker(defaultLatLng, {
        draggable: false,
        zIndexOffset: 1000,
        icon: L.icon.fontAwesome({
            iconClasses: 'fa fa-camera', // you _could_ add other icon classes, not tested.
            markerColor: '#00a9ce',
            iconColor: '#FFF'
        })
    }).addTo(map);

    oCamera.on("move", function (evt) {
        if (sShootingDirection == "towards") {
            return true;
        }
        return drawLine();
    });


    oEye.setLatLng(defaultLatLng);

}, 5000);

sidebar.on('content', function (e) {
    if (e.id == "towards") {
        oEye.dragging.enable();
        oCamera.dragging.disable();
        sShootingDirection = e.id;
        drawLine();
    }
    if (e.id == "from") {
        oEye.dragging.disable();
        oCamera.dragging.enable();
        sShootingDirection = e.id;
        drawLine();
    }
    if (e.id == "between") {
        oEye.dragging.enable();
        oCamera.dragging.enable();
        sShootingDirection = e.id;
        drawLine();
    }

});

jQuery("#timetype").on("change", function (evt) {
    drawLine();
});

jQuery("#timedate").on("change", function (evt) {
    drawLine();
});

jQuery("#camerasw").on("change", function (evt) {
    drawLine();
});

jQuery("#lensfl").on("change", function (evt) {
    drawLine();
});

jQuery("#shootingdirection").on("change", function (evt) {
    drawLine();
});

jQuery("#cameraheight").on("change", function (evt) {
    bDebugOnce = true;
    drawLine();
});


jQuery(".openpanel").on("click", function (evt) {
    var panel = jQuery(evt.target).attr("href").replace("#", "")
    console.log("click", evt, );

    sidebar.open(panel);
});

jQuery("#zoomToLine").on("click", function () {
    map.fitBounds(oLine.getBounds(), {
        padding: [20, 20]
    });
})
