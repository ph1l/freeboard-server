/*
 * Copyright 2012,2013 Robert Huitema robert@42.co.nz
 *
 * This file is part of FreeBoard. (http://www.42.co.nz/freeboard)
 *
 *  FreeBoard is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 
 *  FreeBoard is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 
 *  You should have received a copy of the GNU General Public License
 *  along with FreeBoard.  If not, see <http://www.gnu.org/licenses/>.
 */
// Arrays and pointers for sparkline
var windSparkArraySize;
var windSparkTrue = [];
var windSparkApp = [];
var windOptions;
// // Arrays and pointers for wind direction
var avgArrayA;
var avgPosA = 0;
var avgArrayT;
var avgPosT = 0;

//Arrays and pointers for wind magnitude
var avgVelA;
var avgVelT;
var avgVelPosA = 0;
var avgVelPosT = 0;

var width = 400;
var displayTrue = 0;


function resizeToggleWind(amount) {
    if (amount == null) {
        amount = localStorage.getItem("toggleWind.scale");
    } else {
        amount = 1 * localStorage.getItem("toggleWind.scale") + (1 * amount);
    }
    if (amount == 0.0)
        return;
    localStorage.setItem("toggleWind.scale", amount);
    $("#canvasToggleWindDir").width(width * amount);
    $("#canvasToggleWindDir").height(width * amount);

    var wsmallSize = width;
    var hsmallSize = width / 3.5;
    $("#canvasToggleWind").width(wsmallSize * amount);
    $("#canvasToggleWind").height(hsmallSize * amount);
//    $("#canvasWindApp").width(wsmallSize * amount);
//    $("#canvasWindApp").height(hsmallSize * amount);
    this.initWind();
}

function toggleWindOnMove(event) {
    var e = event;
    localStorage.setItem("toggleWind.top", event.top + "");
    localStorage.setItem("toggleWind.left", event.left + "");
    return;
}

function toggleWindOnLoad() {
    zk.Widget.$(jq('$toggleWind')[0]).setLeft(localStorage.getItem("toggleWind.left"));
    zk.Widget.$(jq('$toggleWind')[0]).setTop(localStorage.getItem("toggleWind.top"));
}

function ToggleWind() {
    this.onmessage = function (navObj) {
        // avoid commands
        if (!navObj)
            return true;

        if (navObj.WSA) {
            avgVelA = JSON.parse(localStorage.getItem("toggleWind.avgVelA"));
            avgVelPosA = localStorage.getItem("toggleWind.avgVelPosA");
            avgVelA[avgVelPosA] = navObj.WSA;
            avgVelPosA = parseInt(avgVelPosA) + 1;
            if (avgVelPosA >= avgVelA.length) {
                avgVelPosA = 0;
            }
            localStorage.setItem("toggleWind.avgVelPosA", avgVelPosA);
            localStorage.setItem("toggleWind.avgVelA", JSON.stringify(avgVelA));
            if (!displayTrue) {
                lcdToggleWind.setValue(navObj.WSA);
                lcdToggleWind.setAltValue(arrayAvg(avgVelA));
            }
            windSparkApp.shift();
            windSparkApp.push(navObj.WST);
        }
        if (navObj.WST) {
            avgVelT = JSON.parse(localStorage.getItem("toggleWind.avgVelT"));
            avgVelPosT = localStorage.getItem("toggleWind.avgVelPosT");
            avgVelT[avgVelPosT] = navObj.WST;
            avgVelPosT = parseInt(avgVelPosT) + 1;
            if (avgVelPosT >= avgVelT.length){
                avgVelPosT = 0;
            }
            localStorage.setItem("toggleWind.avgVelPosT", avgVelPosT);
            localStorage.setItem("toggleWind.avgVelT", JSON.stringify(avgVelT));
            if (displayTrue) {
                lcdToggleWind.setValue(navObj.WST);
                lcdToggleWind.setAltValue(arrayAvg(avgVelT));
            }
            windSparkApp.shift();
            windSparkApp.push(navObj.WST);
        }
        if (navObj.WDA) {
            var c = navObj.WDA;
            // -180 <> 180
            if (!displayTrue) {
                if (c > 180) {
                    radialToggleWindDir.setValueAnimatedLatest(-(360 - c));
                } else {
                    radialToggleWindDir.setValueAnimatedLatest(c);
                }
            }

            // make average
            avgArrayA = JSON.parse(localStorage.getItem("toggleWind.avgArrayA"));
            avgPosA = localStorage.getItem("toggleWind.avgPosA");
            avgArrayA[avgPosA] = c;
            avgPosA = parseInt(avgPosA) + 1;
            localStorage.setItem("toggleWind.avgArrayA", JSON.stringify(avgArrayA));


            if (avgPosA >= avgArrayA.length){
                avgPosA = 0;
            }
            localStorage.setItem("toggleWind.avgPosA", avgPosA);
            if (!displayTrue) {
                if (c > 180) {
                    radialToggleWindDir
                            .setValueAnimatedAverage(-(360 - arrayAvg(avgArrayA)));
                } else {
                    radialToggleWindDir.setValueAnimatedAverage(arrayAvg(avgArrayA));
                }
            }

            c = null;
        }
        if (navObj.WDT) {
            var c = navObj.WDT;
            if (displayTrue) {
                if (c > 0.0 || c < 360.0)
                    radialToggleWindDir.setValueAnimatedLatest(c);
                else
                    radialToggleWindDir.setValueAnimatedLatest(0.0);
            }

            // make average
            avgArrayT = JSON.parse(localStorage.getItem("toggleWind.avgArrayT"));
            avgPosT = localStorage.getItem("toggleWind.avgPosT");
            avgArrayT[avgPosT] = c;
            avgPosT = parseInt(avgPosT) + 1;
            if (avgPosT >= avgArrayT.length){
                avgPosT = 0;
            }
            localStorage.setItem("toggleWind.avgPosT", avgPosT);
            localStorage.setItem("toggleWind.avgArrayT", JSON.stringify(avgArrayT));
            if (displayTrue) {
                if (v > 0.0)
                    radialToggleWindDir.setValueAnimatedAverage(arrayAvg(avgArrayT));
                else
                    radialToggleWindDir.setValueAnimatedAverage(0.0);
            }
        }
        c = null;

        data = null;
    };
}

var tackAngle = 45;

function toggle() {
    var s = zk.Widget.$('$twImageToggle');
    if (s._image.includes("./js/img/ToggleApp.png")) {
        s.setImage("./js/img/ToggleTrue.png");
        displayTrue = 1;
        if (avgVelPosT == 0){
            vel = avgVelT[avgVelT.length - 1];
        } else {
            vel = avgVelT[avgVelPosT - 1];
        }
        avgVel = arrayAvg(avgVelT);
        lcdToggleWind = new steelseries.DisplayMulti('canvasToggleWind', {
            width: smallWidth,
            height: smallHeight,
            lcdDecimals: 1,
            lcdColor: steelseries.LcdColor.BEIGE,
            unitString: "Knots(T)",
            value: vel,
            altValue: avgVel,
            linkAltValue: false,
            unitStringVisible: true,
            detailString: "Avg: ",
            detailStringVisible: true,
        });


        // wind dir

        radialToggleWindDir = new steelseries.WindDirection('canvasToggleWindDir', {
            size: size,
            titleString: "WIND           TRUE",
            roseVisible: false,
            lcdVisible: true,
            lcdColor: steelseries.LcdColor.BEIGE,
            section: areasCloseHaul,
            area: areasCloseHaul,
            pointSymbolsVisible: false,
            // pointSymbols: ["N", "", "", "", "", "", "", ""]
            lcdTitleStrings: ["Latest", "Average"],
            pointerTypeLatest: steelseries.PointerType.TYPE2,
            pointerTypeAverage: steelseries.PointerType.TYPE1,
            backgroundColor: steelseries.BackgroundColor.BROWN,
        });
        $('.dynamicsparkline').sparkline(windSparkTrue, options);
        
    } else {
        s.setImage("./js/img/ToggleApp.png");
        displayTrue = 0;
        if (avgVelPosA == 0){
            vel = avgVelA[avgVelA.length - 1];
        } else {
            vel = avgVelA[avgVelPosA - 1];
        }
        avgVel = arrayAvg(avgVelA);
        lcdToggleWind = new steelseries.DisplayMulti('canvasToggleWind', {
            width: smallWidth,
            height: smallHeight,
            lcdDecimals: 1,
            lcdColor: steelseries.LcdColor.BEIGE,
            linkAltValue: false,
            value: vel,
            altValue: avgVel,
            unitString: "Knots(A)",
            unitStringVisible: true,
            detailString: "Avg: ",
            detailStringVisible: true,
        });

        // wind dir
        if (avgPosA == 0){
            pos = avgArrayA[avgPosA.length - 1];
        } else {
            pos = avgArrayA[avgPosA - 1];
        }
        radialToggleWindDir = new steelseries.WindDirection('canvasToggleWindDir', {
            size: size,
            titleString: "WIND          APP",
            lcdVisible: true,
            lcdColor: steelseries.LcdColor.BEIGE,
            pointSymbolsVisible: false,
            degreeScaleHalf: true,
            section: areasCloseHaul,
            area: areasCloseHaul,
            pointerTypeLatest: steelseries.PointerType.TYPE2,
            pointerTypeAverage: steelseries.PointerType.TYPE1,
            backgroundColor: steelseries.BackgroundColor.BROWN,
        });
        $('.dynamicsparkline').sparkline(windSparkApp, options);
    }
//    initToggleWind();
}


function initToggleWind() {
    var pos;
    var vel;
    // if we cant do canvas, skip out here!
    if (!window.CanvasRenderingContext2D)
        return;

    // Define some sections for wind
    var areasCloseHaul = [
        steelseries.Section((0 - tackAngle), 0, 'rgba(0, 0, 220, 0.3)'),
        steelseries.Section(0, tackAngle, 'rgba(0, 0, 220, 0.3)')];

    // Initialzing lcds
    vpHeight = window.innerHeight - 50;
    vpWidth = window.innerWidth;

    if (typeof (Storage) == "undefined") {
        // Sorry! No Web Storage support..
        alert("Sorry! No Web Storage support. Please use a different browser.");
        return;
    }
    if (localStorage.getItem("toggleWind.scale") == null) {
        localStorage.setItem("toggleWind.scale", "1.0");
        localStorage.setItem("toggleWind.size", width);
        localStorage.setItem("toggleWind.top", "0px");
        localStorage.setItem("toggleWind.left", Math.floor(vpWidth / 2) + "px");
        avgArrayA = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
            0.0, 0.0, 0.0];
        localStorage.setItem("toggleWind.avgArrayA", JSON.stringify(avgArrayA));
        localStorage.setItem("toggleWind.avgPosA", "0");
        var avgArrayT = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
            0.0, 0.0, 0.0];
        localStorage.setItem("toggleWind.avgPosT", "0");
        localStorage.setItem("toggleWind.avgArrayT", JSON.stringify(avgArrayT));

        avgVelA = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
            0.0, 0.0, 0.0];
        avgVelT = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
            0.0, 0.0, 0.0];
        localStorage.setItem("toggleWind.avgVelA", JSON.stringify(avgVelA));
        localStorage.setItem("toggleWind.avgVelT", JSON.stringify(avgVelT));
        localStorage.setItem("toggleWind.avgVelPosA", "0");
        localStorage.setItem("toggleWind.avgVelPosT", "0");
    }

    avgArrayA = JSON.parse(localStorage.getItem("toggleWind.avgArrayA"));
    avgPosA = localStorage.getItem("toggleWind.avgPosA");
    avgArrayT = JSON.parse(localStorage.getItem("toggleWind.avgArrayT"));
    avgPosT = localStorage.getItem("toggleWind.avgPosT");

    avgVelA = JSON.parse(localStorage.getItem("toggleWind.avgVelA"));
    avgVelPosA = localStorage.getItem("toggleWind.avgVelPosA");
    avgVelT = JSON.parse(localStorage.getItem("toggleWind.avgVelT"));
    avgVelPosT = localStorage.getItem("toggleWind.avgVelPosT");

    zk.Widget.$(jq('$toggleWind')[0]).setLeft(localStorage.getItem("toggleWind.left"));
    zk.Widget.$(jq('$toggleWind')[0]).setTop(localStorage.getItem("toggleWind.top"));

    amount = localStorage.getItem("toggleWind.scale");
    size = width * amount;
    
    windSparkArraySize = zk.Widget.$('$sparkPts').getValue();
    while (windSparkArraySize--){
        windSparkTrue.push(0);
        windSparkApp.push(0);
    }

    // Initialzing gauges
    smallWidth = size;
    smallHeight = size / 3.5;

    // wind app
    // wind
//    radialToggleWindDir = null;
    if (!displayTrue) {
        if (avgVelPosA == 0){
            vel = avgVelA[avgVelA.length - 1];
        } else {
            vel = avgVelA[avgVelPosA - 1];
        }
        avgVel = arrayAvg(avgVelA);
        lcdToggleWind = new steelseries.DisplayMulti('canvasToggleWind', {
            width: smallWidth,
            height: smallHeight,
            lcdDecimals: 1,
            lcdColor: steelseries.LcdColor.BEIGE,
            linkAltValue: false,
            value: vel,
            altValue: avgVel,
            unitString: "Knots(A)",
            unitStringVisible: true,
            detailString: "Avg: ",
            detailStringVisible: true,
        });

        // wind dir
        if (avgPosA == 0){
            pos = avgArrayA[avgPosA.length - 1];
        } else {
            pos = avgArrayA[avgPosA - 1];
        }
        radialToggleWindDir = new steelseries.WindDirection('canvasToggleWindDir', {
            size: size,
            titleString: "WIND          APP",
            lcdVisible: true,
            lcdColor: steelseries.LcdColor.BEIGE,
            pointSymbolsVisible: false,
            degreeScaleHalf: true,
            section: areasCloseHaul,
            area: areasCloseHaul,
            pointerTypeLatest: steelseries.PointerType.TYPE2,
            pointerTypeAverage: steelseries.PointerType.TYPE1,
            backgroundColor: steelseries.BackgroundColor.BROWN,
        });
    }

    // wind true
    if (displayTrue) {
        if (avgVelPosT == 0){
            vel = avgVelT[avgVelT.length - 1];
        } else {
            vel = avgVelT[avgVelPosT - 1];
        }
        avgVel = arrayAvg(avgVelT);
        lcdToggleWind = new steelseries.DisplayMulti('canvasToggleWind', {
            width: smallWidth,
            height: smallHeight,
            lcdDecimals: 1,
            lcdColor: steelseries.LcdColor.BEIGE,
            unitString: "Knots(T)",
            value: vel,
            altValue: avgVel,
            linkAltValue: false,
            unitStringVisible: true,
            detailString: "Avg: ",
            detailStringVisible: true,
        });


        // wind dir

        radialToggleWindDir = new steelseries.WindDirection('canvasToggleWindDir', {
            size: size,
            titleString: "WIND           TRUE",
            roseVisible: false,
            lcdVisible: true,
            lcdColor: steelseries.LcdColor.BEIGE,
            section: areasCloseHaul,
            area: areasCloseHaul,
            pointSymbolsVisible: false,
            // pointSymbols: ["N", "", "", "", "", "", "", ""]
            lcdTitleStrings: ["Latest", "Average"],
            pointerTypeLatest: steelseries.PointerType.TYPE2,
            pointerTypeAverage: steelseries.PointerType.TYPE1,
            backgroundColor: steelseries.BackgroundColor.BROWN,
        });
//        radialToggleWindDir.setValueAnimatedLatest(avgArrayT(pos));
//        radialToggleWindDir.setValueAnimatedAverage(arrayAvg(avgArrayT))
    }
    $("#twButtons").width(smallWidth);
    $("#twBbuttons").height(smallHeight);
    $("wSpring").width(width * amount);
    $("wSpring").height(width * amount * 0.4);
    wid = Math.round(width * amount) + "px";
    ht = Math.round(height * .4 * amount) + "px";

    windOptions = {
        width: wid,
        height: ht,
        maxSpotColor: '',
        minSpotColor: '',
        fillColor: '#cdf',
//        fillColor: '',
        chartRangeMin: 0
    };

    addSocketListener(new ToggleWind());

}

function arrayAvg(array) {
    var avg = 0.;
        if (array == undefined) return 0;
        for (i = 0; i < array.length; i++){
            avg += array[i];
        }
        return avg / array.length;
}
