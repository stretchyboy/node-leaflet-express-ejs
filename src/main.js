import L from "leaflet";
import SunCalc from "suncalc";
import LatLon from "mt-latlon";
import jQuery from 'jquery';
import proxy from 'express-http-proxy';
import morgan from 'morgan';
import GeometryUtil from "leaflet-geometryutil";

import "leaflet-search"; //The place search
import "leaflet-openweathermap";
import "leaflet-tilelayer-colorpicker";
import 'leaflet-sidebar-v2';
import "Leaflet.MultiOptionsPolyline";
import "leaflet-fontawesome-markers";
import "leaflet.locatecontrol";

// DONE : Move to full screen map?

import "font-awesome/css/font-awesome.css";
//import "bootstrap/dist/css/bootstrap.css";
import "leaflet/dist/leaflet.css";
import "leaflet-search/dist/leaflet-search.min.css";
import "leaflet-sidebar-v2/css/leaflet-sidebar.css";
import "leaflet-fontawesome-markers/L.Icon.FontAwesome.css";
import "leaflet.locatecontrol/dist/L.Control.Locate.mapbox.css";

import PouchDB from "pouchdb";
import PouchAuth from "pouchdb-authentication";
PouchDB.plugin(PouchAuth);
//https://github.com/pouchdb/add-cors-to-couchdb

var bAuth = false;

//https://pouchdb.com/getting-started.html
var local = new PouchDB('local_db');
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
// locate me https://www.npmjs.com/package/leaflet.locatecontrol
// geo search

//elevation inspiration  https://www.solwise.co.uk/wireless-elevationtool.html
// sun calc http://suncalc.net/

// DONE : find area
// DONE : find area resets yjr marker to the centre of new area
// DONE : select point
// DONE : get elevations
// DONE : find sectors you can see from
// DONE : find places there is a street view (road / parks) you should be able to see from
// DONE : Change day
// TODO : save plans
// TODO : FOV from the start & end of green sections (done ith same colouring)
// TODO : FOV calcuations / tables here https://en.wikipedia.org/wiki/Angle_of_view#Sensor_size_effects_(%22crop_factor%22)



function getOpposite(sensorWidth, focalLength, distanceM) {
    var angle = Math.atan(sensorWidth / (2 * focalLength));
    console.log("angle", angle);
    var oppositeM = distanceM * Math.sin(angle);
    return oppositeM;
}

function drawCone(lFocus, lStart) {
    var fl = jQuery("#lensfl").val() ;
    if(fl == "none"){
        return true;
    }
    var focalLength = fl * (1 / 1000);
    var sensorWidth = jQuery("#camerasw").val() * (1 / 1000);
    
    var distanceM = lStart.distanceTo(lFocus);
    //var distanceM = GeometryUtil.distance(map, lStart, lFocus);
    var oppositeM = getOpposite(sensorWidth, focalLength, distanceM);
    var heading = GeometryUtil.bearing(lStart, lFocus);
    var aPointsL = drawViewLine(map, [GeometryUtil.destination(lFocus, (heading + 90) % 360, oppositeM), lStart], iSteps, iDistance, true);
    var aPointsR = drawViewLine(map, [GeometryUtil.destination(lFocus, (heading - 90) % 360, oppositeM), lStart], iSteps, iDistance, true);
}



// TODO : Login/ Register
// TODO : Change height of view for drone photgraphy (a how high too fly for a view of ???)
// TODO : Droneflight safety data
// TODO : Flightplanning
// DONE : Light condition timings (nautical twilight etc.)

// TODO : Offline first flight/shootoinig plan data (and map flight safety data storage ??)
// TODO : pouchdb and couchdb

// TODO : Site reece recording

// TODO : Will in work on phone / tablet
// TODO : cordova if it will
// BUG : Dragging seems to break the view line

function getDirectionalLine(target, angle, distance) {
    // get position of the sun (azimuth and altitude) at today's sunrise
    var p1 = new LatLon(target[0], target[1]);
    var p2 = p1.destinationPoint(angle, distance);
    // create a red polyline from an array of LatLng points
    var latlngs = [
    [target[0], target[1]],
    [p2.lat(), p2.lon()]
  ];
    return latlngs;
}

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
        attribution: '&copy; <a href="https://mapbox.com/">mapbox</a>'
    }).addTo(map);

var OpenStreetMap_Mapnik = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

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
    "Height Map": RGB_Terrain
};
var overlayMaps = {
    "OSM Mapnik": OpenStreetMap_Mapnik,
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
    oTarget.setLatLng(e.latlng);
}

map.on('locationfound', onLocationFound);

L.control.locate({
    position: "topright",
    keepCurrentZoomLevel:true,
    drawCircle:false,
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
        oTarget.setLatLng(latlng);
    }
}));

var oLineLayer = L.layerGroup().addTo(map);

var sidebar = L.control.sidebar({
    autopan: true, // whether to maintain the centered map point when opening the sidebar
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

function drawViewLine(map, aLine, iSteps, iDistance, bViewFrom){
    
    var aPoints = getPointsOnLine(map, aLine, iSteps);
    var fAngle = 0;
    var iTargetAlt = null;
    var iStepDist = 1000 * (iDistance / iSteps);
    var fMaxAngle = 0;
    if(bViewFrom == null){
        bViewFrom = false;
    }

    aPoints = aPoints.map(function (latLng, i) {
        latLng.alt = getHeightAtPoint(latLng, RGB_Terrain, true);
        if (iTargetAlt == null) {
            fAngle = 0;
            iTargetAlt = latLng.alt;
        } else {
            var iHeight = latLng.alt - iTargetAlt;
            var iDist = i * iStepDist
            //SOHCAHTOA
            fAngle = Math.atan(iHeight / iDist);
        }

        latLng.fAngle = fAngle;
        if(bViewFrom){
            var ViewStatus = VIEW_YES ;
            if (latLng.fAngle == fMaxAngle) {
                ViewStatus = VIEW_POSS;
            } else if (latLng.fAngle > fMaxAngle) {
                ViewStatus = VIEW_NONE;
                fMaxAngle = latLng.fAngle;
            }
        } else{
            var ViewStatus = VIEW_NONE;
            if (latLng.fAngle == fMaxAngle) {
                ViewStatus = VIEW_POSS;
            } else if (latLng.fAngle > fMaxAngle) {
                ViewStatus = VIEW_YES;
                fMaxAngle = latLng.fAngle;
            }
        }
        latLng.ViewStatus = ViewStatus;
        return latLng;
    });
    
    var fMaxAngle = 0;

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
    }).addTo(oLineLayer);
    
    
    return aPoints;
}

var iDistance = 10;
var iSteps = 100;
const VIEW_NONE = 0;
const VIEW_POSS = 1;
const VIEW_YES = 2;

var drawLine = function (Target, sTimeType, sDate) {
    //console.log("drawLine", Target, sTimeType, sDate);
    var oDate = new Date();
    if (sDate) {
        oDate = new Date(sDate);
    }
    
    //console.log("oDate",oDate);
    oLineLayer.clearLayers();
    //var sTimeType = "sunrise";
    var target = [Target.lat, Target.lng];
    // TODO : Drawsunset as well
    var times = SunCalc.getTimes(oDate, target[0], target[1]);
    //nsole.log("times", times);
    jQuery("#time").html(times[sTimeType].toLocaleTimeString());
    var oPos = SunCalc.getPosition(times[sTimeType], target[0], target[1]);
    // get sunrise azimuth in degrees
    var fSunAngle = oPos.azimuth * 180 / Math.PI;
    var aLine = getDirectionalLine(target, fSunAngle, iDistance, "red");

    // TODO : put all this info in the sidebar
    //console.log("times."+sTimeType, times[sTimeType], "oPos", oPos, "fSunAngle", fSunAngle);

    // DONE : Draw graph or a heatline indicating where you should be able to see the target from
    var aPoints = drawViewLine(map, aLine, iSteps, iDistance);

    // TODO : Get google streetview of that point in the right direction
    // take filtered copy of aPoints where  l
    var aViews = aPoints.filter(function (latLng) {
        return latLng.ViewStatus == VIEW_YES;
    });
    
   
    
    var aRequests = aViews.map(function (latLng) {
        drawCone(aPoints[0], latLng);
        
        
        var oParams = {
            key: process.env.GOOGLE_MAPS_API,
            location: "" + latLng.lat + "," + latLng.lng, //latitude/longitu
            size: "300x200",
            heading: Math.round(fSunAngle + 180) % 360,
            fov: 120,
            pitch: 0,
            radius: 50,
            source: "outdoor"
        }
        var sURL = "https://maps.googleapis.com/maps/api/streetview/metadata"; //?parameters
        return jQuery.getJSON(sURL, oParams,
            function (data, textStatus) {
                if (data.status == "OK") {
                    var oTweaked = oParams;
                    oTweaked.location = null;
                    oTweaked.pano = data.pano_id;
                    var sImg = "https://maps.googleapis.com/maps/api/streetview?" + jQuery.param(oTweaked);

                    var oView = L.marker(data.location, {
                        icon: L.icon.fontAwesome({
                            iconClasses: 'fa fa-street-view', // you _could_ add other icon classes, not tested.
                            //markerColor: '#00a9ce',
                            markerColor: '#00cea9',
                            iconColor: '#FFF'
                        })
                    }).bindPopup(L.popup({
                        minWidth: 300
                    }).setContent(
                        '<a target="_blank" href="https://www.google.com/maps/@?api=1&map_action=pano&' +
                        jQuery.param(oTweaked) + '" >' +
                        "<img src=\"" + sImg + "\" ></a>"
                    )).addTo(oLineLayer);
                }
            });
    });

    // map that into requests to https://developers.google.com/maps/documentation/streetview/metadata
    // if there is an image available add a pop up (at the location it sends back) pointing back along the line
    //console.log("aPoints", aPoints);
}

jQuery("#timedate").val(new Date());

// TODO : make target a singleton marker which can be moved / replaced on a search
var target = [53.3797, -1.4744];
var oTarget = L.marker(target);
var oEnd = null;

setTimeout(function () {
    target = [53.3797, -1.4744];
    //var oTarget = L.marker(target).addTo(map);

    oTarget = L.marker(target, {
        draggable: true,
        icon: L.icon.fontAwesome({
            iconClasses: 'fa fa-camera', // you _could_ add other icon classes, not tested.
            markerColor: '#00a9ce',
            iconColor: '#FFF'
        })
    }).addTo(map);

    oTarget.on("move", function (evt) {
        target = evt.latlng;
        drawLine(target, jQuery("#timetype").val(), jQuery("#timedate").val());
    });

    oTarget.setLatLng(target);
}, 5000);

jQuery("#timetype").on("change", function (evt) {
    drawLine(target, jQuery("#timetype").val(), jQuery("#timedate").val());
});

jQuery("#timedate").on("change", function (evt) {
    drawLine(target, jQuery("#timetype").val(), jQuery("#timedate").val());
});

jQuery("#camerasw").on("change", function (evt) {
    drawLine(target, jQuery("#timetype").val(), jQuery("#timedate").val());
});

jQuery("#lensfl").on("change", function (evt) {
    drawLine(target, jQuery("#timetype").val(), jQuery("#timedate").val());
});

//setTimeout(function(){drawLine(target)}, 10000);

jQuery("#zoomToLine").on("click", function () {
    map.fitBounds(oLine.getBounds(), {
        padding: [20, 20]
    });
})
