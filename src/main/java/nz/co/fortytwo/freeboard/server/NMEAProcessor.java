/*
 * Copyright 2012,2013 Robert Huitema robert@42.co.nz
 * 
 * This file is part of FreeBoard. (http://www.42.co.nz/freeboard)
 * 
 * FreeBoard is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * FreeBoard is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with FreeBoard. If not, see <http://www.gnu.org/licenses/>.
 */
package nz.co.fortytwo.freeboard.server;

import java.io.IOException;
import java.util.Date;
import java.util.GregorianCalendar;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Properties;
import java.util.Set;
import java.util.Vector;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.logging.Level;

import net.sf.marineapi.nmea.event.SentenceEvent;
import net.sf.marineapi.nmea.event.SentenceListener;
import net.sf.marineapi.nmea.parser.BVEParser;
import net.sf.marineapi.nmea.parser.CruzproXDRParser;
import net.sf.marineapi.nmea.parser.DataNotAvailableException;
import net.sf.marineapi.nmea.parser.SentenceFactory;
import net.sf.marineapi.nmea.sentence.BVESentence;
import net.sf.marineapi.nmea.sentence.DepthSentence;
import net.sf.marineapi.nmea.sentence.HeadingSentence;
import net.sf.marineapi.nmea.sentence.MWVSentence;
import net.sf.marineapi.nmea.sentence.PositionSentence;
import net.sf.marineapi.nmea.sentence.DateSentence;
import net.sf.marineapi.nmea.sentence.TimeSentence;
import net.sf.marineapi.nmea.sentence.RMCSentence;
import net.sf.marineapi.nmea.sentence.Sentence;
import net.sf.marineapi.nmea.sentence.SentenceId;
import net.sf.marineapi.nmea.sentence.VHWSentence;
import net.sf.marineapi.nmea.util.Measurement;
import nz.co.fortytwo.freeboard.server.util.Constants;
import nz.co.fortytwo.freeboard.server.util.Util;

import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import org.apache.commons.lang3.StringUtils;
import org.apache.log4j.Logger;
import org.zkoss.zul.Messagebox;

/**
 * Processes NMEA sentences in the body of a message, firing events to
 * interested listeners
 *
 * @author robert
 *
 */
public class NMEAProcessor extends FreeboardProcessor implements Processor, FreeboardHandler {

    private static Logger logger = Logger.getLogger(NMEAProcessor.class);
    private static final String DISPATCH_ALL = "DISPATCH_ALL";
    private boolean preferRMC;
    // map of sentence listeners
    private ConcurrentMap<String, List<SentenceListener>> listeners = new ConcurrentHashMap<String, List<SentenceListener>>();

// enable line below to get random depth values for testing.
// See also line 83 and 333
    private RandomGaussian gaussian;

    public NMEAProcessor() {
        try {
            preferRMC = new Boolean(Util.getConfig(null).getProperty(Constants.PREFER_RMC, "true"));
        } catch (Exception e) {
        }

        //register BVE
        SentenceFactory.getInstance().registerParser("BVE", BVEParser.class);
        SentenceFactory.getInstance().registerParser("XDR", CruzproXDRParser.class);

        setNmeaListeners();

        // Enable the code below to generate Gausian distributed random depths
        gaussian = new RandomGaussian();

    }

    public void process(Exchange exchange) throws Exception {
        if (exchange.getIn().getBody() == null) {
            return;
        }
        @SuppressWarnings("unchecked")
        HashMap<String, Object> map = exchange.getIn().getBody(HashMap.class);
        map = handle(map);
        exchange.getIn().setBody(map);
    }

    // @Override
    public HashMap<String, Object> handle(HashMap<String, Object> map) {
        // so we have a string
        String bodyStr = (String) map.get(Constants.NMEA);
        if (StringUtils.isNotBlank(bodyStr)) {
            try {
                if (logger.isDebugEnabled()) {
                    logger.debug("Processing NMEA:" + bodyStr);
                }
                // dont need the NMEA now
                map.remove(Constants.NMEA);
                if (bodyStr.contains("GPGGA")) {
//                    System.out.println("GPGGA + " + bodyStr);
                    bodyStr = new String("$SDDBT,8.1,f,2.4,M,1.3,F*0B");
                }
//                if (bodyStr.contains("GPRMC")) {
//                    System.out.println("GPRMC + " + bodyStr);
//                }
                Sentence sentence = SentenceFactory.getInstance().createParser(bodyStr);
                fireSentenceEvent(map, sentence);
            } catch (Exception e) {
                if (logger.isDebugEnabled()) {
                    logger.debug(e.getMessage(), e);
                }
                logger.error(e.getMessage() + " : " + bodyStr);
            }
        }
        return map;
    }

    /**
     * Adds a {@link SentenceListener} that wants to receive all sentences read
     * by the reader.
     *
     * @param listener {@link SentenceListener} to be registered.
     * @see net.sf.marineapi.nmea.event.SentenceListener
     */
    public void addSentenceListener(SentenceListener listener) {
        registerListener(DISPATCH_ALL, listener);
    }

    /**
     * Adds a {@link SentenceListener} that is interested in receiving only
     * sentences of certain type.RMC
     *
     * @param sl SentenceListener to add
     * @param type Sentence type for which the listener is registered.
     * @see net.sf.marineapi.nmea.event.SentenceListener
     */
    public void addSentenceListener(SentenceListener sl, SentenceId type) {
        registerListener(type.toString(), sl);
    }

    /**
     * Adds a {@link SentenceListener} that is interested in receiving only
     * sentences of certain type.
     *
     * @param sl SentenceListener to add
     * @param type Sentence type for which the listener is registered.
     * @see net.sf.marineapi.nmea.event.SentenceListener
     */
    public void addSentenceListener(SentenceListener sl, String type) {
        registerListener(type, sl);
    }

    /**
     * Remove a listener from reader. When removed, listener will not receive
     * any events from the reader.
     *
     * @param sl {@link SentenceListener} to be removed.
     */
    public void removeSentenceListener(SentenceListener sl) {
        for (List<SentenceListener> list : listeners.values()) {
            if (list.contains(sl)) {
                list.remove(sl);
            }
        }
    }

    /**
     * Dispatch data to all listeners.
     *
     * @param map
     *
     * @param sentence sentence string.
     */
    private void fireSentenceEvent(HashMap<String, Object> map, Sentence sentence) {
        if (!sentence.isValid()) {
            logger.warn("NMEA Sentence is invalid:" + sentence.toSentence());
            return;
        }
        //TODO: Why am I creating all these lists?
        String type = sentence.getSentenceId();
        Set<SentenceListener> list = new HashSet<SentenceListener>();

        if (listeners.containsKey(type)) {
            list.addAll(listeners.get(type));
        }
        if (listeners.containsKey(DISPATCH_ALL)) {
            list.addAll(listeners.get(DISPATCH_ALL));
        }

        for (SentenceListener sl : list) {
            try {
                SentenceEvent se = new SentenceEvent(map, sentence);
                sl.sentenceRead(se);
            } catch (Exception e) {
                logger.error(e.getMessage(), e);
            }
        }

    }

    /**
     * Registers a SentenceListener to hash map with given key.
     *
     * @param type Sentence type to register for
     * @param sl SentenceListener to register
     */
    private void registerListener(String type, SentenceListener sl) {
        if (listeners.containsKey(type)) {
            listeners.get(type).add(sl);
        } else {
            List<SentenceListener> list = new Vector<SentenceListener>();
            list.add(sl);
            listeners.put(type, list);
        }
    }

    /**
     * Adds NMEA sentence listeners to process NMEA to simple output
     *
     * @param processor
     */
    private void setNmeaListeners() {

        addSentenceListener(new SentenceListener() {
            private boolean startLat = true;
            private boolean startLon = true;
            private boolean startTime = true;
            double previousLat = 0;
            double previousLon = 0;
            double gpsPreviousSpeed = 0;
            double paddlePreviousSpeed = 0;
            double dist;
            static final double ALPHA = 1 - 1.0 / 6;
            double convert; // RMC gives speed in Kt

            public void sentenceRead(SentenceEvent evt) {
                // Exchange exchange = (Exchange) evt.getSource();
                // StringBuilder body = new StringBuilder();
                @SuppressWarnings("unchecked")

                HashMap<String, Object> map = (HashMap<String, Object>) evt.getSource();
                Properties config = null;
                try {
                    config = Util.getConfig(null);
                } catch (Exception e) {
                    logger.error(e.getMessage(), e);
                    Messagebox.show("There has been a problem with loading the configuration:" + e.getMessage());
                }
                if (evt.getSentence() instanceof PositionSentence) {
                    PositionSentence sen = (PositionSentence) evt.getSentence();
                    try {
                        if (startLat) {
                            previousLat = sen.getPosition().getLatitude();
                            startLat = false;
                            try {
                                dist = Double.parseDouble(Util.getConfig(null).getProperty(Constants.TRIP_DISTANCE, "0."));
                            } catch (IOException ex) {
                                java.util.logging.Logger.getLogger(NMEAProcessor.class.getName()).log(Level.SEVERE, null, ex);
                            }
                        }
                        double lat1 = previousLat;
                        previousLat = Util.movingAverage(ALPHA, previousLat, sen.getPosition().getLatitude());
                        if (logger.isDebugEnabled()) {
                            logger.debug("lat position:" + sen.getPosition().getLatitude() + ", hemi=" + sen.getPosition().getLatitudeHemisphere());
//                            System.out.println ("lat position:" + sen.getPosition().getLatitude() + ", hemi=" + sen.getPosition().getLatitudeHemisphere());
                        }
                        map.put(Constants.LAT, previousLat);
                        if (startLon) {
                            previousLon = sen.getPosition().getLongitude();
                            startLon = false;
                        }
                        double lon1 = previousLon;
                        previousLon = Util.movingAverage(ALPHA, previousLon, sen.getPosition().getLongitude());
                        map.put(Constants.LON, previousLon);
                        dist += distance(previousLat, lat1, previousLon, lon1);
                        //map.put(Constants.TRIP_DISTANCE, dist);
                        System.out.println("Distance = " + dist);
                    } catch (DataNotAvailableException p) {
                        if (logger.isDebugEnabled()) {
                            logger.debug(p);
                        }
                    }
//                    if ((evt.getSentence() instanceof DateSentence) && (evt.getSentence() instanceof TimeSentence)) {
//                        DateSentence dSen = (DateSentence) evt.getSentence();
//                        TimeSentence tSen = (TimeSentence) evt.getSentence();
//                        try {
//                            // Get START_DATE/START_TIME from config or assign it from Date/Time sentences
//                            String utcDate = Util.getConfig(null).getProperty(Constants.TRIP_START_DATE, dSen.getDate().toISO8601());
//                            String utcTime = Util.getConfig(null).getProperty(Constants.TRIP_START_TIME, tSen.getTime().toISO8601());
//                            GregorianCalendar startDate = new GregorianCalendar(Integer.parseInt(utcDate.substring(0, 2)),
//                                    Integer.parseInt(utcDate.substring(2, 4)),
//                                    Integer.parseInt(utcDate.substring(4, 6)),
//                                    Integer.parseInt(utcTime.substring(0, 2)),
//                                    Integer.parseInt(utcTime.substring(2, 4)),
//                                    Integer.parseInt(utcTime.substring(4, 6)));
//                            GregorianCalendar now = new GregorianCalendar(Integer.parseInt(dSen.getDate().toISO8601().substring(0, 2)),
//                                    Integer.parseInt(dSen.getDate().toISO8601().substring(2, 4)),
//                                    Integer.parseInt(dSen.getDate().toISO8601().substring(4, 6)),
//                                    Integer.parseInt(tSen.getTime().toISO8601().substring(0, 2)),
//                                    Integer.parseInt(tSen.getTime().toISO8601().substring(0, 2)),
//                                    Integer.parseInt(tSen.getTime().toISO8601().substring(0, 2)));
//                            long timeDiff = now.getTimeInMillis() - startDate.getTimeInMillis();
//                        } catch (IOException ex) {
//                            java.util.logging.Logger.getLogger(NMEAProcessor.class.getName()).log(Level.SEVERE, null, ex);
//                        }
//                    }
                }

                if (evt.getSentence() instanceof HeadingSentence) {
                    HeadingSentence sen = (HeadingSentence) evt.getSentence();
                    try {
                        if (sen.isTrue()) {
                            map.put(Constants.COURSE_OVER_GND, sen.getHeading());
                        } else {
                            map.put(Constants.MAG_HEADING, sen.getHeading());
                        }
                    } catch (DataNotAvailableException p) {
                        if (logger.isDebugEnabled()) {
                            logger.debug(p);
                        }
                    }
                }
                if (evt.getSentence() instanceof RMCSentence) {
                    RMCSentence sen = (RMCSentence) evt.getSentence();
                    Util.checkTime(sen);
                    //may conflict with the Heading sentences, producing COG 'wobble' if they dont agree.
                    if (preferRMC) {
                        if (sen.getSpeed() > 0.7d) {
                            map.put(Constants.COURSE_OVER_GND, sen.getCourse());
                        }
                    }
                    gpsPreviousSpeed = Util.movingAverage(ALPHA, gpsPreviousSpeed, sen.getSpeed());
                    String unit = config.getProperty(Constants.SOG_UNIT);
                    switch (unit) {
                        case "km/hr": {
                            convert = 1.852;
                            break;
                        }
                        case "mi/hr": {
                            convert = 1.1450779448;
                            break;
                        }
                        case "Kt": {
                            convert = 1.;
                            break;
                        }
                    }
                    map.put(Constants.SPEED_OVER_GND, gpsPreviousSpeed * convert);
                }
                if (evt.getSentence() instanceof VHWSentence) {
                    VHWSentence sen = (VHWSentence) evt.getSentence();
                    try {
                        paddlePreviousSpeed = Util.movingAverage(ALPHA, paddlePreviousSpeed, sen.getSpeedKnots());
                        map.put(Constants.SPEED_OVER_WATER, paddlePreviousSpeed);
//						previousSpeed = Util.movingAverage(ALPHA, previousSpeed, sen.getSpeedKnots());
//						map.put(Constants.SPEED_OVER_GND, previousSpeed);
                    } catch (DataNotAvailableException p) {
                        if (logger.isDebugEnabled()) {
                            logger.debug(p);
                        }
                    }
                    try {
                        map.put(Constants.MAG_HEADING, sen.getMagneticHeading());
                    } catch (DataNotAvailableException p) {
                        if (logger.isDebugEnabled()) {
                            logger.debug(p);
                        }
                    }
                    try {
                        map.put(Constants.COURSE_OVER_GND, sen.getHeading());
                    } catch (DataNotAvailableException p) {
                        if (logger.isDebugEnabled()) {
                            logger.debug(p);
                        }
                    }

                }

                // MWV wind
                // Mega sends $IIMVW with 0-360d clockwise from bow, (relative to bow)
                // Mega value is int+'.0'
                if (evt.getSentence() instanceof MWVSentence) {
                    MWVSentence sen = (MWVSentence) evt.getSentence();
                    // relative to true north
                    // if (sen.isTrue()) {
                    // map.put( Constants.WDT,sen.getAngle());
                    // map.put( Constants.WST,sen.getSpeed());
                    // map.put( Constants.WSU,sen.getSpeedUnit());
                    //
                    // } else {
                    // relative to bow
                    double angle = sen.getAngle();
                    map.put(Constants.WIND_DIR_APPARENT, angle);
                    map.put(Constants.WIND_SPEED_APPARENT, sen.getSpeed());
                    map.put(Constants.WIND_SPEED_UNITS, sen.getSpeedUnit());
                    // }
                }
                // Cruzpro BVE sentence
                if (evt.getSentence() instanceof BVESentence) {
                    BVESentence sen = (BVESentence) evt.getSentence();
                    if (sen.isFuelGuage()) {
                        map.put(Constants.FUEL_REMAINING, sen.getFuelRemaining());
                        map.put(Constants.FUEL_USE_RATE, sen.getFuelUseRateUnitsPerHour());
                        map.put(Constants.FUEL_USED, sen.getFuelUsedOnTrip());
                    }
                    if (sen.isEngineRpm()) {
                        map.put(Constants.ENGINE_RPM, sen.getEngineRpm());
                        map.put(Constants.ENGINE_HOURS, sen.getEngineHours());
                        map.put(Constants.ENGINE_MINUTES, sen.getEngineMinutes());

                    }
                    if (sen.isTempGuage()) {
                        map.put(Constants.ENGINE_TEMP, sen.getEngineTemp());
                        map.put(Constants.ENGINE_VOLTS, sen.getVoltage());
                        // map.put(Constants.ENGINE_TEMP_HIGH_ALARM, sen.getHighTempAlarmValue());
                        // map.put(Constants.ENGINE_TEMP_LOW_ALARM, sen.getLowTempAlarmValue());

                    }
                    if (sen.isPressureGuage()) {
                        map.put(Constants.ENGINE_OIL_PRESSURE, sen.getPressure());
                        // map.put(Constants.ENGINE_PRESSURE_HIGH_ALARM, sen.getHighPressureAlarmValue());
                        // map.put(Constants.ENGINE_PRESSURE_LOW_ALARM, sen.getLowPressureAlarmValue());

                    }

                }
//                Properties config = null;
//                try {
//                    config = Util.getConfig(null);
//                } catch (Exception e) {
//                    logger.error(e.getMessage(), e);
//                    Messagebox.show("There has been a problem with loading the configuration:" + e.getMessage());
//                }
                if (evt.getSentence() instanceof DepthSentence) {
                    DepthSentence sen = (DepthSentence) evt.getSentence();

                    //Remove comment below to get randomly distributed depts for tessting
                    sen.setDepth(gaussian.getGaussian(2.5, 1.0));

                    //in meters
                    double unit;
                    if (config.getProperty(Constants.DEPTH_UNIT).equals("f")) {
                        unit = 3.28;
                    } else if (config.getProperty(Constants.DEPTH_UNIT).equals("F")) {
                        unit = 0.546807;
                    } else {
                        unit = 1;
                    }
                    double offset = Double.parseDouble(config.getProperty(Constants.DEPTH_ZERO_OFFSET, "0"));
                    map.put(Constants.DEPTH_BELOW_TRANSDUCER, sen.getDepth() * unit + offset);
                }
                // Cruzpro YXXDR sentence
                //from Cruzpro - The fields in the YXXDR sentence are always from the same "critical" functions, in order:
                //RPM
                //Battery #1 Volts
                //Depth
                //Oil Pressure
                //Engine Temperature
                //freeboard.nmea.YXXDR.MaxVu110=RPM,EVV,DBT,EPP,ETT
                if (evt.getSentence() instanceof CruzproXDRParser) {
                    CruzproXDRParser sen = (CruzproXDRParser) evt.getSentence();

                    if (logger.isDebugEnabled()) {
                        logger.debug("XDR:" + sen.toString());
                    }
                    if (StringUtils.isNotBlank(sen.getDevice())) {
                        try {
                            String key = Util.getConfig(null).getProperty(Constants.NMEA_XDR + sen.getTalkerId() + Constants.XDR + sen.getDevice());
                            if (StringUtils.isNotBlank(key)) {
                                String[] keys = key.split(",");
                                List<Measurement> values = sen.getMeasurements();
                                if (values.size() == keys.length) {
                                    //iterate through the values assigning to Freeboard keys
                                    for (int x = 0; x < keys.length; x++) {
                                        if (StringUtils.isNotBlank(keys[x]) && !Constants.XDR_SKIP.equals(keys[x])) {
                                            if (logger.isDebugEnabled()) {
                                                logger.debug("XDR:" + keys[x] + ":" + values.get(x).getValue());
                                            }
                                            map.put(keys[x], values.get(x).getValue());
                                        }
                                    }
                                }
                            }

                        } catch (Exception e) {
                            logger.error(e.getMessage(), e);
                        }
                    }
                }

            }

            public void readingStopped() {
            }

            public void readingStarted() {
            }

            public void readingPaused() {
            }
        });
    }

    private double distance(double lat2, double lat1, double lon2, double lon1) {

        double R = 6373; //radius of Earth in km

        double dlon = lon2 - lon1;
        double dlat = lat2 - lat1;
        double a = Math.pow((Math.sin(dlat / 2)), 2) + Math.cos(lat1) * Math.cos(lat2) * Math.pow((Math.sin(dlon / 2)), 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
}
