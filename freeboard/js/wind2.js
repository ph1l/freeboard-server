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
//var  lcdWindTrue, radialWindDirTrue
var avgArrayA = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0];
var avgPosA = 0;
var avgArrayT = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0];
var avgPosT = 0;

var width = 400;

function resizeWind(amount) {
    if (amount == null) {
        amount = localStorage.getItem("wind.scale");
    } else {
        amount = 1 * localStorage.getItem("wind.scale") + (1 * amount);
    }
    if (amount == 0.0)
        return;
    localStorage.setItem("wind.scale", amount);
    $("#canvasWindDirTrue").width(width * amount);
    $("#canvasWindDirTrue").height(width * amount);
    $("#canvasWindDirApp").width(width * amount);
    $("#canvasWindDirApp").height(width * amount);
    var wsmallSize = width*0.9;
    var hsmallSize = width/3.5;
    $("#canvasWindTrue").width(wsmallSize * amount);
    $("#canvasWindTrue").height(hsmallSize * amount);
    $("#canvasWindApp").width(wsmallSize * amount);
    $("#canvasWindApp").height(hsmallSize * amount);
    this.initWind();
}

function windOnMove(event) {
    var e = event;
    localStorage.setItem("wind.top", event.top + "");
    localStorage.setItem("wind.left", event.left + "");
    return;
}

function windOnLoad(){
    zk.Widget.$(jq('$wind')[0]).setLeft(localStorage.getItem("wind.left"));
    zk.Widget.$(jq('$wind')[0]).setTop(localStorage.getItem("wind.top"));
}

function Wind2() {
    this.onmessage = function (navObj) {
        // avoid commands
        if (!navObj)
            return true;

        if (navObj.WSA) {
            lcdWindApp.setValue(navObj.WSA);
        }
        if (navObj.WST) {
            lcdWindTrue.setValue(navObj.WST);
        }
        if (navObj.WDA) {
            var c = navObj.WDA;
            // -180 <> 180
            if (c > 180) {
                radialWindDirApp.setValueAnimatedLatest(-(360 - c));
            } else {
                radialWindDirApp.setValueAnimatedLatest(c);
            }

            // make average
            avgArrayA[avgPosA] = c;
            avgPosA = avgPosA + 1;
            if (avgPosA >= avgArrayA.length)
                avgPosA = 0;
            var v = 0;
            for (var i = 0; i < avgArrayA.length; i++) {
                v = v + avgArrayA[i];
            }
            if (c > 180) {
                radialWindDirApp
                        .setValueAnimatedAverage(-(360 - (v / avgArrayA.length)));
            } else {
                radialWindDirApp.setValueAnimatedAverage(v / avgArrayA.length);
            }

            c = null;
        }
        if (navObj.WDT) {
            var c = navObj.WDT;
            if (c > 0.0 || c < 360.0)
                radialWindDirTrue.setValueAnimatedLatest(c);
            else
                radialWindDirTrue.setValueAnimatedLatest(0.0);

            // make average
            avgArrayT[avgPosT] = c;
            avgPosT = avgPosT + 1;
            if (avgPosT >= avgArrayT.length)
                avgPosT = 0;
            var v = 0.0;
            for (var i = 0; i < avgArrayT.length; i++) {
                v = v + avgArrayT[i];
            }
            if (v > 0.0)
                radialWindDirTrue.setValueAnimatedAverage(v / avgArrayT.length);
            else
                radialWindDirTrue.setValueAnimatedAverage(0.0);
        }
        c = null;

        data = null;
    };
}

var tackAngle = 45;

function initWind() {
    // if we cant do canvas, skip out here!
    if (!window.CanvasRenderingContext2D)
        return;

    // Define some sections for wind
    var areasCloseHaul = [
        steelseries.Section((0 - tackAngle), 0, 'rgba(0, 0, 220, 0.3)'),
        steelseries.Section(0, tackAngle, 'rgba(0, 0, 220, 0.3)')];
    var areasCloseHaulTrue = [
        steelseries.Section((360 - tackAngle), 0, 'rgba(0, 0, 220, 0.3)'),
        steelseries.Section(0, tackAngle, 'rgba(0, 0, 220, 0.3)')];

    // Initialzing lcds
    vpHeight = window.innerHeight - 50;
    vpWidth = window.innerWidth;

    if (typeof (Storage) == "undefined") {
        // Sorry! No Web Storage support..
        alert("Sorry! No Web Storage support. Please use a different browser.");
        return;
    }
    if (localStorage.getItem("wind.scale") == null) {
        localStorage.setItem("wind.scale", "1.0");
        localStorage.setItem("wind.size", width);
        localStorage.setItem("wind.top", "0px");
        localStorage.setItem("wind.left", Math.floor(vpWidth / 2) + "px");
    }
    zk.Widget.$(jq('$wind')[0]).setLeft(localStorage.getItem("wind.left"));
    zk.Widget.$(jq('$wind')[0]).setTop(localStorage.getItem("wind.top"));

    amount = localStorage.getItem("wind.scale");
    size = width * amount;


    // Initialzing gauges
    smallWidth = size * 0.9;
    smallHeight = size / 3.5;

    // wind app
    // wind
    lcdWindApp = new steelseries.DisplayMulti('canvasWindApp', {
        width: smallWidth,
        height: smallHeight,
        lcdDecimals: 1,
        lcdColor: steelseries.LcdColor.BEIGE,
        unitString: "Knots(A)",
        unitStringVisible: true,
        detailString: "Avg: ",
        detailStringVisible: true,
    });

    // wind dir
    radialWindDirApp = new steelseries.WindDirection('canvasWindDirApp', {
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

    // wind true
    lcdWindTrue = new steelseries.DisplayMulti('canvasWindTrue', {
        width: smallWidth,
        height: smallHeight,
        lcdDecimals: 1,
        lcdColor: steelseries.LcdColor.BEIGE,
        unitString: "Knots(T)",
        unitStringVisible: true,
        detailString: "Avg: ",
        detailStringVisible: true,
    });

    // wind dir

    radialWindDirTrue = new steelseries.WindDirection('canvasWindDirTrue', {
        size: size,
        titleString: "WIND           TRUE",
        roseVisible: false,
        lcdVisible: true,
        lcdColor: steelseries.LcdColor.BEIGE,
        section: areasCloseHaulTrue,
        area: areasCloseHaulTrue,
        pointSymbolsVisible: false,
        // pointSymbols: ["N", "", "", "", "", "", "", ""]
        lcdTitleStrings: ["Latest", "Average"],
        pointerTypeLatest: steelseries.PointerType.TYPE2,
        pointerTypeAverage: steelseries.PointerType.TYPE1,
        backgroundColor: steelseries.BackgroundColor.BROWN,
    });

    addSocketListener(new Wind2());

}
