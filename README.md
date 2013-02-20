Scraping Kent Counties Website using Node.js
============================================

Node.js scripts to scape accesskent.com for all homes in GR and E. GR for houeses with back taxes for years 2010 and 2011.

You can run findparcelids.js to lotate all parcel ids in Gr and E. Gr. but they are also saved in "data/all_gr_and_egr_parcels.json"

You can run scrape-by-list.js and set config file "parcelFile" to "data/all_gr_and_egr_parcels.json" or other to scrape for all parcels in json file. It will output to the "outFile" in the config file.

You can setup a file called config/aws.json with aws keys to send email through SES for status update of scraping as it can take some time.

reports.js formats a csv file of the data found.

make_kml.js formats Google maps kml data with a csv file of lat,lng,address and this can be created using http://www.gpsvisualizer.com/geocoder/. 

Final:https://maps.google.com/maps/ms?msid=213196167136601417088.0004d61fdc134d856fa62&msa=0&ll=42.941596,-85.6707&spn=0.140744,0.338173&iwloc=0004d61fdcb0b1b7a85b6
