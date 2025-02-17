(function($, OC) {
    $(function() {
        if (window.isSecureContext) {
            window.navigator.registerProtocolHandler('geo', OC.generateUrl('/apps/maps/openGeoLink/') + '%s', 'Nextcloud Maps');
        }
        mapController.initMap();
        mapController.map.favoritesController = favoritesController;
        favoritesController.initFavorites(mapController.map);
        routingController.initRoutingControl(mapController.map);
        photosController.initLayer(mapController.map);
        nonLocalizedPhotosController.initLayer(mapController.map);
        mapController.map.photosController = photosController;
        contactsController.initLayer(mapController.map);
        mapController.map.contactsController = contactsController;
        tracksController.initController(mapController.map);
        tracksController.map.tracksController = tracksController;
        devicesController.initController(mapController.map);
        mapController.map.devicesController = devicesController;
        searchController.initController(mapController.map);

        // once controllers have been set/initialized, we can restore option values from server
        optionsController.restoreOptions();
        geoLinkController.showLinkLocation();

        // Popup
        $(document).on('click', '#opening-hours-header', function() {
            $('#opening-hours-table').toggle();
            $('#opening-hours-table-toggle-expand').toggle();
            $('#opening-hours-table-toggle-collapse').toggle();
        });

        document.onkeydown = function (e) {
            e = e || window.event;
            if (e.key === 'Escape') {
                if (favoritesController.movingFavoriteId !== null) {
                    favoritesController.leaveMoveFavoriteMode();
                }
                if (contactsController.movingBookid !== null) {
                    contactsController.leaveMoveContactMode();
                }
                if (photosController.movingPhotoPath !== null) {
                    photosController.leaveMovePhotoMode();
                }
            }
        };
        window.onclick = function(event) {
            if (event.button === 0) {
                $('.leaflet-control-layers').hide();
                $('.easy-button-container').show();
                if (!event.target.matches('.app-navigation-entry-utils-menu-button button')) {
                    $('.app-navigation-entry-menu.open').removeClass('open');
                }
                mapController.map.contextmenu.hide();
            }
        };

        // click on menu buttons
        $('body').on('click',
            '.routingMenuButton, .favoritesMenuButton, .categoryMenuButton, .photosMenuButton, .contactsMenuButton, ' +
            '.nonLocalizedPhotosMenuButton, .devicesMenuButton, .deviceMenuButton, .tracksMenuButton, .trackMenuButton',
            function(e) {
            var menu = $(this).parent().parent().parent().find('> .app-navigation-entry-menu');
            var wasOpen = menu.hasClass('open');
            $('.app-navigation-entry-menu.open').removeClass('open');
            if (!wasOpen) {
                menu.addClass('open');
            }
        });
        // right click on entry line
        $('body').on('contextmenu',
            '#navigation-routing > .app-navigation-entry-utils, #navigation-routing > a, ' +
            '#navigation-favorites > .app-navigation-entry-utils, #navigation-favorites > a, ' +
            '.category-line > a, .category-line > .app-navigation-entry-utils, ' +
            '#navigation-devices > .app-navigation-entry-utils, #navigation-devices > a, ' +
            '.device-line > a, .device-line > .app-navigation-entry-utils, ' +
            '#navigation-tracks > .app-navigation-entry-utils, #navigation-tracks > a, ' +
            '.track-line > a, .track-line > .app-navigation-entry-utils, ' +
            '#navigation-nonLocalizedPhotos > .app-navigation-entry-utils, #navigation-nonLocalizedPhotos > a, ' +
            '#navigation-contacts > .app-navigation-entry-utils, #navigation-contacts > a, ' +
            '#navigation-photos > .app-navigation-entry-utils, #navigation-photos > a ',
            function(e) {
            var menu = $(this).parent().find('> .app-navigation-entry-menu');
            var wasOpen = menu.hasClass('open');
            $('.app-navigation-entry-menu.open').removeClass('open');
            if (!wasOpen) {
                menu.addClass('open');
            }
            return false;
        });
        // right click on expand icon
        $('body').on('contextmenu', '#navigation-favorites, #navigation-photos, #navigation-devices, #navigation-tracks', function(e) {
            var id = $(e.target).attr('id');
            if (e.target.tagName === 'LI' && (id === 'navigation-favorites' || id === 'navigation-photos' || id === 'navigation-devices' || id === 'navigation-tracks')) {
                var menu = $(this).find('> .app-navigation-entry-menu');
                var wasOpen = menu.hasClass('open');
                $('.app-navigation-entry-menu.open').removeClass('open');
                if (!wasOpen) {
                    menu.addClass('open');
                }
                return false;
            }
        });
    });

    var geoLinkController = {
        marker: null,
        lat: null,
        lng: null,
        showLinkLocation: function() {
            var geourlElem = document.getElementById('geourl');
            if (geourlElem) {
                var geourl = geourlElem.value;
                [this.lat, this.lng] = geourl.substring(4).split(',');
                this.marker  = L.marker([this.lat, this.lng]);
                mapController.map.addLayer(this.marker);
                mapController.map.setView([this.lat, this.lng], 15);
            }
        },

        shareLocation: function(e) {
            var lat = e.latlng.lat;
            var lng = e.latlng.lng;
            var geoLink = 'geo:' + lat.toFixed(6) + ',' + lng.toFixed(6);
            var dummy = $('<input id="dummycopy">').val(geoLink).appendTo('body').select();
            document.execCommand('copy');
            $('#dummycopy').remove();
            OC.Notification.showTemporary(t('maps', 'Geo link ({geoLink}) copied to clipboard', {geoLink: geoLink}));
        },
    };

    var optionsController = {
        optionValues: {},
        enabledFavoriteCategories: [],
        enabledTracks: [],
        enabledDevices: [],
        enabledDeviceLines: [],
        saveOptionValues: function (optionValues) {
            var req = {
                options: optionValues
            };
            var url = OC.generateUrl('/apps/maps/saveOptionValue');
            $.ajax({
                type: 'POST',
                url: url,
                data: req,
                async: true
            }).done(function (response) {
            }).fail(function() {
                OC.Notification.showTemporary(
                    t('maps', 'Failed to save option values')
                );
            });
        },

        restoreOptions: function () {
            var that = this;
            var url = OC.generateUrl('/apps/maps/getOptionsValues');
            var req = {};
            var optionsValues = {};
            $.ajax({
                type: 'POST',
                url: url,
                data: req,
                async: true
            }).done(function (response) {
                optionsValues = response.values;
                // set tilelayer before showing photo layer because it needs a max zoom value
                if (optionsValues.hasOwnProperty('tileLayer')) {
                    mapController.changeTileLayer(optionsValues.tileLayer);
                }
                else {
                    mapController.changeTileLayer('OpenStreetMap');
                }
                if (!optionsValues.hasOwnProperty('photosLayer') || optionsValues.photosLayer === 'true') {
                    photosController.toggleLayer();
                }
                if (!optionsValues.hasOwnProperty('contactLayer') || optionsValues.contactLayer === 'true') {
                    contactsController.toggleLayer();
                }
                if (optionsValues.hasOwnProperty('locControlEnabled') && optionsValues.locControlEnabled === 'true') {
                    mapController.locControl.start();
                }
                if (!optionsValues.hasOwnProperty('favoriteCategoryListShow') || optionsValues.favoriteCategoryListShow === 'true') {
                    favoritesController.toggleCategoryList();
                }
                if (optionsValues.hasOwnProperty('enabledFavoriteCategories')
                    && optionsValues.enabledFavoriteCategories
                    && optionsValues.enabledFavoriteCategories !== '')
                {
                    that.enabledFavoriteCategories = optionsValues.enabledFavoriteCategories.split('|');
                }
                if (!optionsValues.hasOwnProperty('favoritesEnabled') || optionsValues.favoritesEnabled === 'true') {
                    favoritesController.toggleFavorites();
                }
                if (optionsValues.hasOwnProperty('routingEnabled') && optionsValues.routingEnabled === 'true') {
                    routingController.toggleRouting();
                }
                if (!optionsValues.hasOwnProperty('trackListShow') || optionsValues.trackListShow === 'true') {
                    tracksController.toggleTrackList();
                }
                if (optionsValues.hasOwnProperty('enabledTracks')
                    && optionsValues.enabledTracks
                    && optionsValues.enabledTracks !== '')
                {
                    that.enabledTracks = optionsValues.enabledTracks.split('|').map(function (x) {
                        return parseInt(x);
                    });
                }
                if (getUrlParameter('track') || !optionsValues.hasOwnProperty('tracksEnabled') || optionsValues.tracksEnabled === 'true') {
                    tracksController.toggleTracks();
                }
                if (!optionsValues.hasOwnProperty('deviceListShow') || optionsValues.deviceListShow === 'true') {
                    devicesController.toggleDeviceList();
                }
                if (optionsValues.hasOwnProperty('enabledDevices')
                    && optionsValues.enabledDevices
                    && optionsValues.enabledDevices !== '')
                {
                    that.enabledDevices = optionsValues.enabledDevices.split('|').map(function (x) {
                        return parseInt(x);
                    });
                }
                if (optionsValues.hasOwnProperty('enabledDeviceLines')
                    && optionsValues.enabledDeviceLines
                    && optionsValues.enabledDeviceLines !== '')
                {
                    that.enabledDeviceLines = optionsValues.enabledDeviceLines.split('|').map(function (x) {
                        return parseInt(x);
                    });
                }
                if (!optionsValues.hasOwnProperty('devicesEnabled') || optionsValues.devicesEnabled === 'true') {
                    devicesController.toggleDevices();
                }
                if (optionsValues.hasOwnProperty('trackMe') && optionsValues.trackMe === 'true') {
                    $('#track-me').prop('checked', true);
                    devicesController.launchTrackLoop();
                }

                // save tile layer when changed
                // do it after restore, otherwise restoring triggers save
                mapController.map.on('baselayerchange ', function(e) {
                    optionsController.saveOptionValues({tileLayer: e.name});
                    // make sure map is clean
                    for (var ol in mapController.baseOverlays) {
                        mapController.map.removeLayer(mapController.baseOverlays[ol]);
                    }
                    for (var tl in mapController.baseLayers) {
                        if (tl !== e.name) {
                            mapController.map.removeLayer(mapController.baseLayers[tl]);
                        }
                    }
                    if (e.name === 'Watercolor') {
                        mapController.map.addLayer(mapController.baseOverlays['Roads and labels']);
                    }
                    mapController.layerChanged(e.name);
                });
            }).fail(function() {
                OC.Notification.showTemporary(
                    t('maps', 'Failed to restore options values')
                );
            });
        }
    };

    var mapController = {
        searchMarkerLayerGroup: null,
        map: {},
        locControl: undefined,
        baseLayers: undefined,
        displaySearchResult: function(results) {
            this.searchMarkerLayerGroup.clearLayers();
            var result, searchMarker;
            for (var i=0; i < results.length; i++) {
                result = results[i];
                searchMarker = L.marker([result.lat, result.lon], {
                    icon: this.searchIcon
                });
                var name = result.display_name;
                // popup
                var popupContent = searchController.parseOsmResult(result);
                searchMarker.bindPopup(popupContent, {className: 'search-result-popup'});
                // tooltip
                var name = '';
                if (result.namedetails && result.namedetails.name) {
                    name = result.namedetails.name;
                }
                else {
                    name = result.display_name;
                }
                var tooltipContent = brify(name, 40);
                searchMarker.bindTooltip(tooltipContent, {className: 'search-result-tooltip'});
                searchMarker.addTo(this.searchMarkerLayerGroup);
            }
            if (results.length === 1) {
                this.searchMarkerLayerGroup.getLayers()[0].openPopup();
                this.map.flyTo([results[0].lat, results[0].lon], 15, {duration: 1});
            }
        },
        initMap: function() {
            var that = this;
            this.searchIcon = L.divIcon({
                iconAnchor: [12, 25],
                className: 'route-waypoint route-middle-waypoint',
                html: ''
            });
            var attribution = '&copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>';

            var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution : attribution,
                noWrap: false,
                detectRetina: false,
                maxZoom: 19
            });

            var attributionESRI = 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN...';
            var ESRIAerial = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution : attributionESRI,
                noWrap: false,
                detectRetina: true,
                maxZoom: 19
            });
            var roadsOverlay = L.tileLayer('https://{s}.tile.openstreetmap.se/hydda/roads_and_labels/{z}/{x}/{y}.png', {
                maxZoom: 18,
                opacity: 0.7,
                attribution: '<a href="http://openstreetmap.se/" target="_blank">OpenStreetMap Sweden</a> &mdash; Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            });
            var ESRITopo = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
                attribution : attributionESRI,
                noWrap: false,
                detectRetina: false,
                maxZoom: 19
            });
            var attributionOpenTopo = 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="http://viewfinderpanoramass.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)';
            var openTopo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                attribution : attributionOpenTopo,
                noWrap: false,
                detectRetina: false,
                maxZoom: 17
            });
            var attributionDark = '&copy; Map tiles by CartoDB, under CC BY 3.0. Data by OpenStreetMap, under ODbL.';
            var dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
                attribution : attributionDark,
                noWrap: false,
                detectRetina: false,
                maxZoom: 18
            });
            var attributionWatercolor = '<a href="https://leafletjs.com" title="A JS library for interactive maps">Leaflet</a> | © Map tiles by <a href="https://stamen.com">Stamen Design</a>, under <a href="https://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>, Data by <a href="https://openstreetmap.org">OpenStreetMap</a>, under <a href="https://creativecommons.org/licenses/by-sa/3.0">CC BY SA</a>.';
            var watercolor = L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/watercolor/{z}/{x}/{y}.{ext}', {
                attribution : attributionWatercolor,
                noWrap: false,
                detectRetina: false,
                maxZoom: 18,
                ext: 'jpg',
                subdomains: 'abcd'
            });
            var starImageUrl = OC.generateUrl('/svg/core/actions/star-dark?color=000000');
            var markerRedImageUrl = OC.generateUrl('/svg/core/actions/address?color=EE3333');
            var markerBlueImageUrl = OC.generateUrl('/svg/core/actions/address?color=3333EE');
            var markerGreenImageUrl = OC.generateUrl('/svg/core/actions/address?color=33EE33');
            var photoImageUrl = OC.generateUrl('/svg/core/places/picture?color=000000');
            var contactImageUrl = OC.generateUrl('/svg/core/actions/user?color=000000');
            var shareImageUrl = OC.generateUrl('/svg/core/actions/share?color=000000');
            this.map = L.map('map', {
                zoom: 2,
                zoomControl: false,
                maxZoom: 19,
                minZoom: 2,
                center: new L.LatLng(0, 0),
                maxBounds: new L.LatLngBounds(new L.LatLng(-90, 720), new L.LatLng(90, -720)),
                layers: [],
                // right click menu
                contextmenu: false,
                contextmenuWidth: 160,
                contextmenuItems: [{
                    text: t('maps', 'Add a favorite'),
                    icon: starImageUrl,
                    callback: favoritesController.contextAddFavorite
                }, {
                    text: t('maps', 'Place photos'),
                    icon: photoImageUrl,
                    callback: photosController.contextPlacePhotos
                }, {
                    text: t('maps', 'Place photo folder'),
                    icon: photoImageUrl,
                    callback: photosController.contextPlacePhotoFolder
                }, {
                    text: t('maps', 'Place contact'),
                    icon: contactImageUrl,
                    callback: contactsController.contextPlaceContact
                }, {
                    text: t('maps', 'Share this location'),
                    icon: shareImageUrl,
                    callback: geoLinkController.shareLocation
                }, '-', {
                    text: t('maps', 'Route from here'),
                    icon: markerGreenImageUrl,
                    callback: routingController.contextRouteFrom
                }, {
                    text: t('maps', 'Add route point'),
                    icon: markerBlueImageUrl,
                    callback: routingController.contextRoutePoint
                }, {
                    text: t('maps', 'Route to here'),
                    icon: markerRedImageUrl,
                    callback: routingController.contextRouteTo
                }]
            });
            this.map.on('contextmenu', function(e) {
                if ($(e.originalEvent.target).attr('id') === 'map') {
                    that.map.contextmenu.showAt(L.latLng(e.latlng.lat, e.latlng.lng));
                }
            });

            this.searchMarkerLayerGroup = L.featureGroup();
            this.map.addLayer(this.searchMarkerLayerGroup);

            var locale = OC.getLocale();
            var imperial = (
                locale === 'en_US' ||
                locale === 'en_GB' ||
                locale === 'en_AU' ||
                locale === 'en_IE' ||
                locale === 'en_NZ' ||
                locale === 'en_CA'
            );
            var metric = !imperial;
            L.control.scale({metric: metric, imperial: imperial, position: 'bottomleft'})
                .addTo(this.map);
            //L.control.mousePosition().addTo(this.map);

            L.control.zoom({position: 'bottomright'}).addTo(this.map);

            this.locControl = L.control.locate({
                position: 'bottomright',
                drawCircle: true,
                drawMarker: true,
                showPopup: false,
                icon: 'fa fa-map-marker-alt',
                iconLoading: 'fa fa-spinner fa-spin',
                strings: {
                    title: t('maps', 'See current location')
                },
                flyTo: true,
                returnToPrevBounds: true,
                setView: 'untilPan',
                showCompass: true,
                locateOptions: {enableHighAccuracy: true, maxZoom: 15}
            }).addTo(this.map);
            $('.leaflet-control-locate a').click( function(e) {
                optionsController.saveOptionValues({locControlEnabled: mapController.locControl._active});
            });

            this.layersButton = L.easyButton({
                position: 'bottomright',
                states: [{
                    stateName: 'no-importa',
                    icon:      '<a class="icon icon-menu" style="height: 100%"> </a>',
                    title:     t('maps', 'Other layers'),
                    onClick: function(btn, map) {
                        $('.leaflet-control-layers').toggle();
                        $('.easy-button-container').toggle();
                    }
                }]
            });
            this.layersButton.addTo(this.map);

            // tile layer selector
            this.baseLayers = {
                'OpenStreetMap': osm,
                'ESRI Aerial': ESRIAerial,
                'ESRI Topo': ESRITopo,
                'OpenTopoMap': openTopo,
                'Dark': dark,
                'Watercolor': watercolor
            }
            this.baseOverlays = {
                'Roads and labels': roadsOverlay
            }
            this.controlLayers = L.control.layers(
                this.baseLayers,
                this.baseOverlays,
                {position: 'bottomright', collapsed: false}
            ).addTo(this.map);
            // hide openstreetmap, ESRI Aerial and roads/labels because they are dynamically managed
            this.controlLayers.removeLayer(this.baseLayers['OpenStreetMap']);
            this.controlLayers.removeLayer(this.baseLayers['ESRI Aerial']);
            this.controlLayers.removeLayer(this.baseOverlays['Roads and labels']);
            $('.leaflet-control-layers').toggle();

            // main layers buttons
            var esriImageUrl = OC.filePath('maps', 'css/images', 'esri.jpg');
            this.esriButton = L.easyButton({
                position: 'bottomright',
                states: [{
                    stateName: 'no-importa',
                    icon:      '<img src="'+esriImageUrl+'"/>',
                    title:     t('maps', 'Aerial map'),
                    onClick: function(btn, map) {
                        that.changeTileLayer('ESRI Aerial', true);
                    }
                }]
            });
            var osmImageUrl = OC.filePath('maps', 'css/images', 'osm.png');
            this.osmButton = L.easyButton({
                position: 'bottomright',
                states: [{
                    stateName: 'no-importa',
                    icon:      '<img src="'+osmImageUrl+'"/>',
                    title:     t('maps', 'Classic map'),
                    onClick: function(btn, map) {
                        that.changeTileLayer('OpenStreetMap', true);
                    }
                }]
            });
        },

        changeTileLayer: function(name, save=false) {
            for (var tl in this.baseLayers) {
                this.map.removeLayer(this.baseLayers[tl]);
            }
            for (var ol in this.baseOverlays) {
                this.map.removeLayer(this.baseOverlays[ol]);
            }
            this.map.addLayer(this.baseLayers[name]);
            if (name === 'ESRI Aerial' || name === 'Watercolor') {
                this.map.addLayer(this.baseOverlays['Roads and labels']);
            }
            this.layerChanged(name);
            if (save) {
                optionsController.saveOptionValues({tileLayer: name});
            }
        },

        layerChanged: function(name) {
            if (name === 'ESRI Aerial') {
                this.esriButton.remove();
                this.osmButton.addTo(this.map);
            }
            else {
                this.osmButton.remove();
                this.esriButton.addTo(this.map);
            }
            // map maxZoom should be dynamic (if not specified at map creation) but something crashes like that
            // so we set it on map creation and
            // we change it on tile layer change
            if (this.baseLayers[name].options.maxZoom) {
                this.map.setMaxZoom(this.baseLayers[name].options.maxZoom);
            }
            $('.leaflet-control-layers').hide();
            $('.easy-button-container').show();
        },
    };

    var routingController = {
        control: undefined,
        map: undefined,
        enabled: false,
        initRoutingControl: function(map) {
            this.map = map;
            var that = this;

            this.beginIcon = L.divIcon({
                iconAnchor: [12, 25],
                className: 'route-waypoint route-begin-waypoint',
                html: ''
            });
            this.middleIcon = L.divIcon({
                iconAnchor: [12, 25],
                className: 'route-waypoint route-middle-waypoint',
                html: ''
            });
            this.endIcon = L.divIcon({
                iconAnchor: [12, 25],
                className: 'route-waypoint route-end-waypoint',
                html: ''
            });

            this.osrmRouter = L.Routing.osrmv1({
                serviceUrl: 'https://router.project-osrm.org/route/v1',
                //profile: 'driving', // works with demo server
                profile: 'car', // works with demo server
                //profile: 'bicycle', // does not work with demo server...
                //profile: 'foot', // does not work with demo server...
                suppressDemoServerWarning: true,
                // this makes OSRM use our local translations
                // otherwise it uses osrm-text-instructions which makes us import another lib
                stepToText: function(e) {
                }
            });
            this.ghRouter = L.Routing.graphHopper(undefined /* api key */, {
                serviceUrl: 'http://192.168.0.66:8989/route',
                urlParameters : {
                    vehicle: 'car' // available ones : car, foot, bike, bike2, mtb, racingbike, motorcycle
                }
            });
            var lang = OC.getLocale();
            // this is for all routing engines except OSRM
            L.Routing.Localization[lang] = {
                directions: {
                    N: t('maps', 'north'),
                    NE: t('maps', 'northeast'),
                    E: t('maps', 'east'),
                    SE: t('maps', 'southeast'),
                    S: t('maps', 'south'),
                    SW: t('maps', 'southwest'),
                    W: t('maps', 'west'),
                    NW: t('maps', 'northwest'),
                    SlightRight: t('maps', 'slight right'),
                    Right: t('maps', 'right'),
                    SharpRight: t('maps', 'sharp right'),
                    SlightLeft: t('maps', 'slight left'),
                    Left: t('maps', 'left'),
                    SharpLeft: t('maps', 'sharp left'),
                    Uturn: t('maps', 'Turn around')
                },
                instructions: {
                    // instruction, postfix if the road is named
                    'Head':
                    [t('maps', 'Head {dir}'), t('maps', ' on {road}')],
                    'Continue':
                    [t('maps', 'Continue {dir}')],
                    'TurnAround':
                    [t('maps', 'Turn around')],
                    'WaypointReached':
                    [t('maps', 'Waypoint reached')],
                    'Roundabout':
                    [t('maps', 'Take the {exitStr} exit in the roundabout'), t('maps', ' onto {road}')],
                    'DestinationReached':
                    [t('maps', 'Destination reached')],
                    'Fork': [t('maps', 'At the fork, turn {modifier}'), t('maps', ' onto {road}')],
                    'Merge': [t('maps', 'Merge {modifier}'), t('maps', ' onto {road}')],
                    'OnRamp': [t('maps', 'Turn {modifier} on the ramp'), t('maps', ' onto {road}')],
                    'OffRamp': [t('maps', 'Take the ramp on the {modifier}'), t('maps', ' onto {road}')],
                    'EndOfRoad': [t('maps', 'Turn {modifier} at the end of the road'), t('maps', ' onto {road}')],
                    'Onto': t('maps', 'onto {road}')
                },
                ui: {
                    startPlaceholder: t('maps', 'Start'),
                    viaPlaceholder: t('maps', 'Via {viaNumber}'),
                    endPlaceholder: t('maps', 'Destination')
                },
                formatOrder: function(n) {
                    return n + 'º';
                },
                units: {
                    meters: t('maps', 'm'),
                    kilometers: t('maps', 'km'),
                    yards: t('maps', 'yd'),
                    miles: t('maps', 'mi'),
                    hours: t('maps', 'h'),
                    minutes: t('maps', 'min'),
                    seconds: t('maps', 's')
                }
            };
            this.control = L.Routing.control({
                router: this.osrmRouter,
                position: 'topleft',
                routeWhileDragging: true,
                reverseWaypoints: true,
                geocoder: L.Control.Geocoder.nominatim(),
                language: lang,
                lineOptions: {
                    styles: [{color: 'black', opacity: 0.15, weight: 9}, {color: 'white', opacity: 0.8, weight: 6}, {color: 'blue', opacity: 1, weight: 2}],
                },
                pointMarkerStyle: {radius: 5, color: '#03f', fillColor: 'white', opacity: 1, fillOpacity: 0.7},
                createMarker: this.createMarker
            })
            .on('routingerror', this.onRoutingError)
            .on('routingstart', this.onRoutingStart)
            .on('routesfound', this.onRoutingEnd);
            //this.setRouter(this.ghRouter);
            //console.log(this.control);

            // toggle routing control
            $('body').on('click', '#navigation-routing > a', function(e) {
                that.toggleRouting();
                optionsController.saveOptionValues({routingEnabled: that.enabled});
            });
            // export
            $('body').on('click', '.exportCurrentRoute', function(e) {
                that.exportRoute();
            });
        },

        toggleRouting: function() {
            if (this.enabled) {
                this.control.remove();
                $('#navigation-routing').removeClass('active');
                $('#map').focus();
                this.enabled = false;
            }
            else {
                this.control.addTo(this.map);
                $('#navigation-routing').addClass('active');
                this.enabled = true;
                $('.leaflet-routing-geocoder input').first().focus();
            }
        },

        setRouter: function(router) {
            this.control._router = router;
            this.control.options.router = router;
        },

        onRoutingError: function(e) {
            var msg = e.error.target.responseText
            try {
                var json = $.parseJSON(e.error.target.responseText);
                if (json.message) {
                    msg = json.message;
                }
            }
            catch (e) {
            }
            OC.Notification.showTemporary(t('maps', 'Routing error:') + ' ' + msg);
            routingController.onRoutingEnd();
        },

        onRoutingStart: function(e) {
            $('#navigation-routing').addClass('icon-loading-small');
            $('.leaflet-routing-reverse-waypoints').addClass('icon-loading-small');
        },

        onRoutingEnd: function(e) {
            $('#navigation-routing').removeClass('icon-loading-small');
            $('.leaflet-routing-reverse-waypoints').removeClass('icon-loading-small');
            // TODO understand why routingstart is sometimes triggered after routesfound
            // just in case routingstart is triggered again (weird):
            setTimeout(function() {
                $('#navigation-routing').removeClass('icon-loading-small');
                $('.leaflet-routing-reverse-waypoints').removeClass('icon-loading-small');
            }, 5000);
        },

        // this has been tested with graphhopper
        setRouterVehicle: function(vehicle) {
            this.control.getRouter().options.urlParameters.vehicle = vehicle;
            this.control.route();
        },

        createMarker: function(i, wpt, n) {
            var icon;
            if (i === 0) {
                icon = routingController.beginIcon;
            }
            else if (i === n - 1) {
                icon = routingController.endIcon;
            }
            else {
                icon = routingController.middleIcon;
            }
            var marker = L.marker(wpt.latLng, {icon: icon, draggable: true});
            return marker;
        },

        exportRoute: function() {
            if (this.control.hasOwnProperty('_selectedRoute')
                && this.control._selectedRoute.hasOwnProperty('coordinates')
                && this.control._selectedRoute.coordinates.length > 0
            ) {
                var latLngCoords = this.control._selectedRoute.coordinates;
                var gpxRteCoords = '';
                for (var i=0; i < latLngCoords.length; i++) {
                    gpxRteCoords = gpxRteCoords + '    <rtept lat="' + latLngCoords[i].lat + '" lon="' + latLngCoords[i].lng + '">\n' +
                        '    </rtept>\n';
                }
                var name = this.control._selectedRoute.name;
                var totDist = this.control._selectedRoute.summary.totalDistance;
                var totTime = this.control._selectedRoute.summary.totalTime;

                $('#navigation-routing').addClass('icon-loading-small');
                var req = {
                    coords: gpxRteCoords,
                    name: name,
                    totDist: totDist,
                    totTime: totTime
                };
                var url = OC.generateUrl('/apps/maps/exportRoute');
                $.ajax({
                    type: 'POST',
                    url: url,
                    data: req,
                    async: true
                }).done(function (response) {
                    OC.Notification.showTemporary(t('maps', 'Route exported in {path}', {path: response}));
                }).always(function (response) {
                    $('#navigation-routing').removeClass('icon-loading-small');
                }).fail(function() {
                    OC.Notification.showTemporary(t('maps', 'Failed to export current route'));
                });
            }
        },

        contextRouteFrom: function(e) {
            if (!routingController.enabled) {
                routingController.toggleRouting();
            }
            routingController.setRouteFrom(e.latlng);
        },

        contextRouteTo: function(e) {
            if (!routingController.enabled) {
                routingController.toggleRouting();
            }
            routingController.setRouteTo(e.latlng);
        },

        contextRoutePoint: function(e) {
            if (!routingController.enabled) {
                routingController.toggleRouting();
            }
            routingController.addRoutePoint(e.latlng);
        },

        setRouteFrom: function(latlng) {
            this.control.spliceWaypoints(0, 1, latlng);
        },

        setRouteTo: function(latlng) {
            this.control.spliceWaypoints(this.control.getWaypoints().length - 1, 1, latlng);
        },

        setRoutePoint: function(i, latlng) {
            this.control.spliceWaypoints(i, 1, latlng);
        },

        addRoutePoint: function(latlng) {
            this.control.spliceWaypoints(this.control.getWaypoints().length - 1, 0, latlng);
        },
    };

    var timeFilterController = {
        min: 0,
        max: Date.now()/1000,
        minInitialized: false,
        maxInitialized: false,
        valueBegin: null,
        valueEnd: null,
        updateFilterTimeBegin: [],
        updateFilterTimeEnd: [],
        onUpdateCallbackBlock: false,
        onChangeCallbackBlock: false,
        slider : document.getElementById('timeRangeSlider'),
        sliderConnect: null,
        connect: function () {
            noUiSlider.create(this.slider, {
                start: [20, 80],
                connect: true,
                behaviour: 'drag',
                tooltips: [{
                        to: function (x) {
                            return new Date(x*1000).toIsoString();
                        },
                    }, {
                    to: function (x) {
                        return new Date(x*1000).toIsoString();
                    }
                }],
                range: {
                    'min': 0,
                    'max': 1
                }
            });
            this.sliderConnect = this.slider.getElementsByClassName('noUi-connect')[0];
            this.updateSliderRange(this.min, this.max);
            this.setSlider(this.min, this.max);
            var that = this;
            this.slider.noUiSlider.on('update', function(values, handle, unencoded, tap, positions) {
                if (!that.onUpdateCallbackBlock){
                    that.onUpdateCallbackBlock = true;
                    if (handle === 0) {
                        that.valueBegin = unencoded[0];
                        photosController.updateTimeFilterBegin(that.valueBegin);
                        nonLocalizedPhotosController.updateTimeFilterBegin(that.valueBegin);
                        contactsController.updateTimeFilterBegin(that.valueBegin);
                    }
                    else {
                        that.valueEnd = unencoded[1];
                        photosController.updateTimeFilterEnd(that.valueEnd);
                        nonLocalizedPhotosController.updateTimeFilterEnd(that.valueEnd);
                        contactsController.updateTimeFilterEnd(that.valueEnd);
                    }
                    favoritesController.updateFilterDisplay();
                    tracksController.updateFilterDisplay();
                    devicesController.updateFilterDisplay();

                    that.onUpdateCallbackBlock = false;
                    if (Math.round(unencoded[0]) < Math.round(that.min) ||
                        Math.round(unencoded[1]) > Math.round(that.max) ||
                        positions[1] - positions[0] < 10
                    ) {
                        that.sliderConnect.classList.add('timeRangeSlider-active');
                    } else {
                        that.sliderConnect.classList.remove('timeRangeSlider-active');
                    }
                }
            });
            this.slider.noUiSlider.on('change', function(values, handle, unencoded, tap, positions) {
                if (!that.onChangeCallbackBlock) {
                    that.onChangeCallbackBlock = true;
                    if (unencoded[0] < that.min) {
                        var delta = that.min-unencoded[0];
                        var r = that.max-that.min;
                        that.updateSliderRange(that.min - 25* delta*delta/r, that.max);
                    }
                    if (unencoded[1] > that.max) {
                        var delta = -that.max+unencoded[1];
                        var r = that.max-that.min;
                        that.updateSliderRange(that.min, that.max + 25*delta*delta/r);
                    }
                    if (positions[1] - positions[0] < 10) {
                        var m = (unencoded[0] + unencoded[1])/2;
                        var d = Math.max((unencoded[1] - unencoded[0])/2,1);
                        that.updateSliderRange(m-2.5*d, m+2.5*d);
                        that.setSlider(unencoded[0], unencoded[1]);
                    }
                    that.sliderConnect.classList.remove('timeRangeSlider-active');
                    that.onChangeCallbackBlock = false;
                }
            });
            this.slider.ondblclick = function() {
                that.updateSliderRangeFromController();
                that.setSliderToMaxInterval();
            };
        },
        updateSliderRange: function(min, max) {
            var range = max - min;
            this.slider.noUiSlider.updateOptions({
                range: {
                    'min': min - range/10,
                    'max': max + range/10
                },
            });
            this.min = min;
            this.max = max;
        },
        setSlider: function(min, max) {
            this.slider.noUiSlider.set([min, max]);
        },
        // when a controller's data has changed
        // this changes the min/max slider reachable values (it does not set the values)
        // it should be called when there are changes in controller data
        // and when user wants to reset the slider to see everything
        updateSliderRangeFromController: function() {
            var i;
            var mins = [];
            var maxs = [];
            var rawMins = [
                favoritesController.firstDate,
                tracksController.firstDate,
                photosController.photoMarkersOldest,
                nonLocalizedPhotosController.nonLocalizedPhotoMarkersOldest,
                contactsController.contactMarkersOldest,
                devicesController.firstDate
            ];
            var rawMaxs = [
                favoritesController.lastDate,
                tracksController.lastDate,
                photosController.photoMarkersNewest,
                nonLocalizedPhotosController.nonLocalizedPhotoMarkersNewest,
                contactsController.contactMarkersNewest,
                devicesController.lastDate
            ];
            // get rid of null values
            for (i=0; i < rawMins.length; i++) {
                if (rawMins[i] !== null) {
                    mins.push(rawMins[i]);
                }
            }
            for (i=0; i < rawMaxs.length; i++) {
                if (rawMaxs[i] !== null) {
                    maxs.push(rawMaxs[i]);
                }
            }

            var cmin = null;
            var cmax = null;
            // get the min of all controllers
            if (mins.length > 0) {
                cmin = Math.min(...mins);
            }
            // get the max of all controllers
            if (maxs.length > 0) {
                cmax = Math.max(...maxs);
            }
            if (cmin !== null && cmax !== null) {
                $(this.slider).fadeIn();
                this.min = cmin;
                this.max = cmax;
                // avoid min == max
                if (cmin === cmax) {
                    this.min = cmin - 10;
                    this.max = cmax + 10;
                }
                this.updateSliderRange(this.min, this.max);
            }
            else {
                $(this.slider).fadeOut();
            }
        },
        // on first data load, controllers want to set the slider values to global common max
        setSliderToMaxInterval: function() {
            this.setSlider(this.min, this.max);
        }
    };


    var photosController = new PhotosController(optionsController, timeFilterController);
    var nonLocalizedPhotosController = new NonLocalizedPhotosController(optionsController, timeFilterController, photosController);
    var contactsController = new ContactsController(optionsController, timeFilterController);
    var favoritesController = new FavoritesController(optionsController, timeFilterController);
    var tracksController = new TracksController(optionsController, timeFilterController);
    var devicesController = new DevicesController(optionsController, timeFilterController);

    timeFilterController.connect();

    var searchController = {
        map: null,
        SEARCH_BAR: 1,
        ROUTING_FROM: 2,
        ROUTING_TO: 3,
        ROUTING_POINT: 4,
        currentLocalAutocompleteData: [],
        initController: function(map) {
            this.map = map;
            var that = this;
            // Search
            $('#search-form').submit(function(e) {
                e.preventDefault();
                that.submitSearchForm();
            });
            $('#search-submit').click(function(e) {
                e.preventDefault();
                that.submitSearchForm();
            });
            $('#search-term').on('focus', function(e) {
                $(this).select();
                that.setSearchAutocomplete(that.SEARCH_BAR);
            });
            $('body').on('focus', '.leaflet-routing-geocoder input', function(e) {
                var inputs = $('.leaflet-routing-geocoder input');
                var nbInputs = inputs.length;
                var index = inputs.index($(this));
                if (index === 0) {
                    that.setSearchAutocomplete(that.ROUTING_FROM);
                }
                else if (index === nbInputs - 1) {
                    that.setSearchAutocomplete(that.ROUTING_TO);
                }
                else {
                    that.setSearchAutocomplete(that.ROUTING_POINT, index);
                }
            });
            $('body').on('keyup', '.leaflet-routing-geocoder input', function(e) {
                // if we press enter => disable autocomplete to let nominatim results dropdown appear
                if (e.key === 'Enter') {
                    $(this).autocomplete('close');
                    $(this).autocomplete('disable');
                }
                // if any other key (except arrows up/down) is pressed => enable autocomplete again
                else if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') {
                    $('.leaflet-routing-geocoder-result').removeClass('leaflet-routing-geocoder-result-open');
                    $(this).autocomplete('enable');
                    $(this).autocomplete('search');
                }
            });
            // replace JQuery ui autocomplete matching function
            // to make 'one three' match 'one two three' for example.
            // search terms in the same order
            $.ui.autocomplete.filter = function (array, terms) {
                arrayOfTerms = terms.split(' ');
                var term = $.map(arrayOfTerms, function (tm) {
                    return $.ui.autocomplete.escapeRegex(tm);
                }).join('.*');
                var matcher = new RegExp(term, 'i');
                return $.grep(array, function (value) {
                    return matcher.test(value.label || value.value || value);
                });
            };
            // search result add favorite
            $('body').on('click', '.search-add-favorite', function(e) {
                var lat = parseFloat($(this).attr('lat'));
                var lng = parseFloat($(this).attr('lng'));
                var name = $(this).parent().find('.location-header').text();
                favoritesController.addFavoriteDB('', lat, lng, name);
                that.map.closePopup();
            });
        },

        setSearchAutocomplete: function(field, routingPointIndex=null) {
            var fieldElement;
            if (field === this.SEARCH_BAR) {
                fieldElement = $('#search-term');
            }
            else if (field === this.ROUTING_FROM) {
                fieldElement = $('.leaflet-routing-geocoder input').first();
            }
            else if (field === this.ROUTING_TO) {
                fieldElement = $('.leaflet-routing-geocoder input').last();
            }
            else if (field === this.ROUTING_POINT) {
                fieldElement = $('.leaflet-routing-geocoder input').eq(routingPointIndex);
            }
            var that = this;
            var data = [];
            // get favorites
            var favData = favoritesController.getAutocompData();
            data.push(...favData);
            // get contacts
            var contactData = contactsController.getAutocompData();
            data.push(...contactData);
            // get devices
            var devData = devicesController.getAutocompData();
            data.push(...devData);
            data.push(...this.getExtraAutocompleteData(field));
            that.currentLocalAutocompleteData = data;
            fieldElement.autocomplete({
                source: data,
                select: function (e, ui) {
                    var it = ui.item;
                    if (it.type === 'favorite') {
                        that.map.setView([it.lat, it.lng], 15);
                    }
                    else if (it.type === 'contact') {
                        that.map.setView([it.lat, it.lng], 15);
                    }
                    else if (it.type === 'device') {
                        devicesController.zoomOnDevice(it.id);
                    }
                    else if (it.type === 'address') {
                        if (field === that.SEARCH_BAR) {
                            mapController.displaySearchResult([it.result]);
                        }
                    }
                    else if (it.type === 'mylocation') {
                        navigator.geolocation.getCurrentPosition(function (position) {
                            var lat = position.coords.latitude;
                            var lng = position.coords.longitude;
                            if (field === that.SEARCH_BAR) {
                                that.map.setView([lat, lng], 15);
                            }
                            if (field === that.SEARCH_BAR || field === that.ROUTING_TO) {
                                routingController.setRouteTo(L.latLng(lat, lng));
                            }
                            else if (field === that.ROUTING_FROM) {
                                routingController.setRouteFrom(L.latLng(lat, lng));
                                $('.leaflet-routing-geocoder input').last().focus();
                            }
                            else if (field === that.ROUTING_POINT) {
                                routingController.setRoutePoint(routingPointIndex, L.latLng(lat, lng));
                                $('.leaflet-routing-geocoder input').last().focus();
                            }
                        });
                        return;
                    }
                    else if (it.type === 'poi') {
                        that.submitSearchPOI(it.value, it.label);
                        return;
                    }

                    // forward to routing controller
                    if (field === that.SEARCH_BAR || field === that.ROUTING_TO) {
                        routingController.setRouteTo(L.latLng(it.lat, it.lng));
                    }
                    else if (field === that.ROUTING_FROM) {
                        routingController.setRouteFrom(L.latLng(it.lat, it.lng));
                        $('.leaflet-routing-geocoder input').last().focus();
                    }
                    else if (field === that.ROUTING_POINT) {
                        routingController.setRoutePoint(routingPointIndex, L.latLng(it.lat, it.lng));
                        $('.leaflet-routing-geocoder input').last().focus();
                    }
                }
            }).data('ui-autocomplete')._renderItem = function(ul, item) {
                var iconClass = 'icon-link';
                var iconElem = '';
                if (item.type === 'favorite') {
                    iconClass = 'icon-favorite';
                }
                else if (item.type === 'contact') {
                    iconClass = 'icon-group';
                }
                else if (item.type === 'device') {
                    if (item.subtype === 'computer') {
                        iconClass = 'icon-desktop';
                    }
                    else {
                        iconClass = 'icon-phone';
                    }
                }
                else if (item.type === 'mylocation') {
                    iconClass = 'icon-address';
                }
                else if (item.type === 'poi') {
                    iconClass = '';
                    iconElem = '<i class="far fa-dot-circle"></i>';
                }
                // shorten label if needed
                var label = item.label;
                if (label.length > 35) {
                    label = label.substring(0, 35) + '…';
                }
                var listItem = $('<li></li>')
                    .data('item.autocomplete', item)
                    .append('<a class="searchCompleteLink"><button class="searchCompleteIcon ' + iconClass + '">' + iconElem + '</button> ' + label + '</a>')
                    .appendTo(ul);
                return listItem;
            };
        },

        submitSearchForm: function() {
            var that = this;
            var str = $('#search-term').val();
            if (str.length < 1) {
                return;
            }

            this.search(str).then(function(results) {
                if (results.length === 0) {
                    OC.Notification.showTemporary(t('maps', 'No search result'));
                    return;
                }
                else if (results.length === 1) {
                    var result = results[0];
                    mapController.displaySearchResult([result]);
                }
                else {
                    var newData = [];
                    newData.push(...that.currentLocalAutocompleteData);
                    for (var i=0; i < results.length; i++) {
                        newData.push({
                            type: 'address',
                            label: results[i].display_name,
                            value: results[i].display_name,
                            result: results[i],
                            lat: results[i].lat,
                            lng: results[i].lon
                        });
                    }
                    $('#search-term').autocomplete('option', {source: newData});
                    $('#search-term').autocomplete('search');
                }
            });
        },

        submitSearchPOI: function(type, typeName) {
            var that = this;

            var mapBounds = this.map.getBounds();
            var latMin = mapBounds.getSouth();
            var latMax = mapBounds.getNorth();
            var lngMin = mapBounds.getWest();
            var lngMax = mapBounds.getEast();
            this.searchPOI(type, latMin, latMax, lngMin, lngMax).then(function(results) {
                if (results.length === 0) {
                    OC.Notification.showTemporary(t('maps', 'No {POItypeName} found', {POItypeName: typeName}));
                    return;
                }
                mapController.displaySearchResult(results);
            });
        },

        getExtraAutocompleteData: function(field) {
            data = [];
            if (navigator.geolocation && window.isSecureContext) {
                data.push({
                    type: 'mylocation',
                    label: t('maps', 'My location'),
                    value: t('maps', 'My location')
                });
            }
            if (field === this.SEARCH_BAR) {
                data.push({
                    type: 'poi',
                    label: t('maps', 'Restaurant'),
                    value: 'restaurant'
                });
                data.push({
                    type: 'poi',
                    label: t('maps', 'Fast food'),
                    value: 'fast food'
                });
                data.push({
                    type: 'poi',
                    label: t('maps', 'Bar'),
                    value: 'bar'
                });
                data.push({
                    type: 'poi',
                    label: t('maps', 'Supermarket'),
                    value: 'supermarket'
                });
                data.push({
                    type: 'poi',
                    label: t('maps', 'Cafe'),
                    value: 'cafe'
                });
                data.push({
                    type: 'poi',
                    label: t('maps', 'Library'),
                    value: 'library'
                });
                data.push({
                    type: 'poi',
                    label: t('maps', 'School'),
                    value: 'school'
                });
                data.push({
                    type: 'poi',
                    label: t('maps', 'Sports centre'),
                    value: 'sports centre'
                });
                data.push({
                    type: 'poi',
                    label: t('maps', 'Gas station'),
                    value: 'fuel'
                });
                data.push({
                    type: 'poi',
                    label: t('maps', 'Parking'),
                    value: 'parking'
                });
                data.push({
                    type: 'poi',
                    label: t('maps', 'Bicycle parking'),
                    value: 'bicycle parking'
                });
                data.push({
                    type: 'poi',
                    label: t('maps', 'Car rental'),
                    value: 'car rental'
                });
                data.push({
                    type: 'poi',
                    label: t('maps', 'ATM'),
                    value: 'atm'
                });
                data.push({
                    type: 'poi',
                    label: t('maps', 'Pharmacy'),
                    value: 'pharmacy'
                });
                data.push({
                    type: 'poi',
                    label: t('maps', 'Cinema'),
                    value: 'cinema'
                });
                data.push({
                    type: 'poi',
                    label: t('maps', 'Public toilets'),
                    value: 'toilets'
                });
                data.push({
                    type: 'poi',
                    label: t('maps', 'Drinking water'),
                    value: 'water point'
                });
                data.push({
                    type: 'poi',
                    label: t('maps', 'Hospital'),
                    value: 'hospital'
                });
                data.push({
                    type: 'poi',
                    label: t('maps', 'Doctors'),
                    value: 'doctors'
                });
                data.push({
                    type: 'poi',
                    label: t('maps', 'Dentist'),
                    value: 'dentist'
                });
                data.push({
                    type: 'poi',
                    label: t('maps', 'Hotel'),
                    value: 'hotel'
                });
            }
            return data;
        },

        isGeocodeable: function(str) {
            var pattern = /^\s*\d+\.?\d*\,\s*\d+\.?\d*\s*$/;
            return pattern.test(str);
        },
        search: function(str) {
            var searchTerm = encodeURIComponent(str);
            var apiUrl = 'https://nominatim.openstreetmap.org/search/' + searchTerm + '?format=json&addressdetails=1&extratags=1&namedetails=1&limit=8';
            return $.getJSON(apiUrl, {}, function(response) {
                return response;
            });
        },
        searchPOI: function(type, latMin, latMax, lngMin, lngMax) {
            var query, i;
            var amenities = ['restaurant', 'fast food', 'bar', 'parking', 'hospital', 'cafe', 'school', 'bicycle parking', 'cinema', 'supermarket'];
            var qs = ['atm', 'pharmacy', 'hotel', 'doctors', 'dentist', 'library', 'car rental', 'fuel', 'toilets', 'water point', 'sports centre'];
            if (amenities.indexOf(type) !== -1) {
                query = 'amenity='+encodeURIComponent(type);
            }
            else if (qs.indexOf(type) !== -1) {
                query = 'q='+encodeURIComponent(type);
            }
            var apiUrl = 'https://nominatim.openstreetmap.org/search' +
                '?format=json&addressdetails=1&extratags=1&namedetails=1&limit=100&' +
                'viewbox=' + parseFloat(lngMin) + ',' + parseFloat(latMin) + ',' + parseFloat(lngMax) + ',' + parseFloat(latMax) + '&' +
                'bounded=1&' + query;
            return $.getJSON(apiUrl, {}, function(response) {
                return response;
            });
        },
        geocode: function(latlng) {
            if (!this.isGeocodeable(latlng)) {
                return;
            }
            var splits = latlng.split(',');
            var lat = splits[0].trim();
            var lon = splits[1].trim();
            var apiUrl = 'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon='+ lon + '&addressdetails=1';
            return $.getJSON(apiUrl, {}, function(response) {
                return response;
            });
        },
        parseOsmResult: function(result) {
            var add = result.address;
            var road, postcode, city, state, name;
            if (add.road) {
                road = add.road;
                if (add.house_number) {
                    road += ' ' + add.house_number;
                }
            }
            if (add.postcode) {
                postcode = add.postcode;
            }
            if (add.city || add.town || add.village) {
                if (add.city) {
                    city = add.city;
                }
                else if (add.town) {
                    city = add.town;
                }
                else if (add.village) {
                    city = add.village;
                }
                if (add.state) {
                     state = add.state;
                }
            }
            var details = result.namedetails;
            if (details.name) {
                name = details.name;
            }

            var unformattedHeader;
            if (name) {
                unformattedHeader = name;
            }
            else if (road) {
                unformattedHeader = road;
            }
            else if (city) {
                unformattedHeader = city;
            }

            var unformattedDesc = '';
            var needSeparator = false;
            // add road to desc if it is not heading and exists (isn't heading, if 'name' is set)
            if (name && road) {
                unformattedDesc = road;
                needSeparator = true;
            }
            if (postcode) {
                if (needSeparator) {
                    unformattedDesc += ', ';
                    needSeparator = false;
                }
                unformattedDesc += postcode;
            }
            if (city) {
                if (needSeparator) {
                    unformattedDesc += ', ';
                    needSeparator = false;
                }
                else if (unformattedDesc.length > 0) {
                    unformattedDesc += ' ';
                }
                unformattedDesc += city;
            }
            if (state && add && add.country_code == 'us') { // assume that state is only important for us addresses
                if (unformattedDesc.length > 0) {
                    unformattedDesc += ' ';
                }
                unformattedDesc += '(' + state + ')';
            }

            var header = '<h2 class="location-header">' + unformattedHeader + '</h2>';
            if (result.icon) {
                header = '<div class="inline-wrapper"><img class="location-icon" src="' + result.icon + '" />' + header + '</div>';
            }
            var desc = '<span class="location-city">' + unformattedDesc + '</span>';
            desc += '<button class="search-add-favorite" lat="'+result.lat+'" lng="'+result.lon+'">' +
                '<span class="icon-favorite"> </span> ' + t('maps', 'Add to favorites') + '</button>';

            // Add extras to parsed desc
            var extras = result.extratags;
            if (extras.opening_hours) {
                desc += '<div id="opening-hours-header" class="inline-wrapper"><img class="popup-icon" src="'+OC.filePath('maps', 'img', 'recent.svg')+'" />';
                var oh = new opening_hours(extras.opening_hours, result);
                var isCurrentlyOpen = oh.getState();
                var changeDt = oh.getNextChange();
                var currentDt = new Date();
                if (changeDt) {
                    var dtDiff = changeDt.getTime() - currentDt.getTime();
                    dtDiff = dtDiff / 60000; // get diff in minutes
                    if (isCurrentlyOpen) {
                        desc += '<span class="poi-open">' + t('maps', 'Open') + '&nbsp;</span>';
                        if (dtDiff <= 60) {
                            desc += '<span class="poi-closes">,&nbsp;' + t('maps', 'closes in {nb} minutes', {nb: parseInt(dtDiff)}) + '</span>';
                        }
                        else {
                            desc += '<span>&nbsp;' + t('maps', 'until {date}', {date: changeDt.toLocaleTimeString()}) + '</span>';
                        }
                    }
                    else {
                        desc += '<span class="poi-closed">' + t('maps', 'Closed') + '&nbsp;</span>';
                        desc += '<span class="poi-opens">' + t('maps', 'opens at {date}', {date: changeDt.toLocaleTimeString()}) + '</span>';
                    }
                }
                desc += '<img id="opening-hours-table-toggle-collapse" src="' +
                    OC.filePath('maps', 'img', 'triangle-s.svg') +
                    '" /><img id="opening-hours-table-toggle-expand" src="' +
                    OC.filePath('maps', 'img', 'triangle-e.svg') +
                    '" /></div>';
                var todayStart = currentDt;
                todayStart.setHours(0);
                todayStart.setMinutes(0);
                todayStart.setSeconds(0);
                var sevDaysEnd = new Date(todayStart);
                var sevDaysMs = 7 * 24 * 60 * 60 * 1000;
                sevDaysEnd.setTime(sevDaysEnd.getTime()+sevDaysMs);
                var intervals = oh.getOpenIntervals(todayStart, sevDaysEnd);
                desc += '<table id="opening-hours-table">';
                // intervals should be 7, if 8, then first entry is interval after 00:00:00 from last day
                if (intervals.length == 8) {
                    // set end time of last element to end time of first element and remove it
                    intervals[7][1] = intervals[0][1];
                    intervals.splice(0, 1);
                }
                for (var i=0; i<intervals.length; i++) {
                    var from = intervals[i][0];
                    var to = intervals[i][1];
                    var day = from.toLocaleDateString([], {weekday:'long'});
                    if (i==0) {
                        desc += '<tr class="selected">';
                    }
                    else {
                        desc += '<tr>';
                    }
                    desc += '<td class="opening-hours-day">' + day + '</td>';
                    var startTime = from.toLocaleTimeString();
                    var endTime =to.toLocaleTimeString();
                    desc += '<td class="opening-hours-hours">' + startTime + ' - ' + endTime + '</td>';
                    desc += '</tr>';
                }
                desc += '</table>';
            }
            if (extras.website) {
                desc += '<div class="inline-wrapper"><img class="popup-icon" src="'+OC.filePath('maps', 'img', 'link.svg')+'" /><a href="' + extras.website + '" target="_blank">' + helpers.beautifyUrl(extras.website) + '</a></div>';
            }
            if (extras.phone) {
                desc += '<div class="inline-wrapper"><img class="popup-icon" src="'+OC.filePath('maps', 'img', 'link.svg')+'" /><a href="tel:' + extras.phone + '" target="_blank">' + extras.phone + '</a></div>';
            }
            if (extras.email) {
                desc += '<div class="inline-wrapper"><img class="popup-icon" src="'+OC.filePath('maps', 'img', 'mail.svg')+'" /><a href="mailto:' + extras.email + '" target="_blank">' + extras.email + '</a></div>';
            }

            return header + desc;
        }
    };

    var helpers = {
        beautifyUrl: function(url) {
            return url.replace(/^(?:\w+:|)\/\/(?:www\.|)(.*[^\/])\/*$/, '$1');
        }
    };

})(jQuery, OC);
