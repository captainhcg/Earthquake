/* Controllers */
var interanaApp = angular.module('interanaApp', []);

interanaApp.config(['$httpProvider', function ($httpProvider) {
    $httpProvider.defaults.useXDomain = true;
    delete $httpProvider.defaults.headers.common['X-Requested-With'];
}]);

interanaApp.service('disCalculator', function() {
    var EARTH_RADIUS = 3960.0; // miles
    var PI = Math.PI;

    var getRad = function(d){
        return d*PI/180.0;
    };

    this.cal = function(p1, p2){
        var radLat1 = getRad(p1.lat);
        var radLat2 = getRad(p2.lat);

        var a = radLat1 - radLat2;
        var b = getRad(p1.lng) - getRad(p2.lng);

        var s = 2*Math.asin(Math.sqrt(Math.pow(Math.sin(a/2),2) + Math.cos(radLat1)*Math.cos(radLat2)*Math.pow(Math.sin(b/2),2)));

        s = s*EARTH_RADIUS;

        return s;
    };
});

interanaApp.service('geoGetter', function($http) {
    var api_url = "http://maps.googleapis.com/maps/api/geocode/json";

    this.getGeo = function(address){
        return $http.get(api_url + "?address=" + window.encodeURIComponent(address));
    };
});

interanaApp.service('googleMapService', function(){
    var map = null;
    var center_marker = null;
    this.initialize = function(center){
        var mapOptions = {
            zoom: 8,
            center: new google.maps.LatLng(center.lat, center.lng),
            styles: [{"featureType":"landscape","stylers":[{"saturation":-100},{"lightness":65},{"visibility":"on"}]},{"featureType":"poi","stylers":[{"saturation":-100},{"lightness":51},{"visibility":"simplified"}]},{"featureType":"road.highway","stylers":[{"saturation":-100},{"visibility":"simplified"}]},{"featureType":"road.arterial","stylers":[{"saturation":-100},{"lightness":30},{"visibility":"on"}]},{"featureType":"road.local","stylers":[{"saturation":-100},{"lightness":40},{"visibility":"on"}]},{"featureType":"transit","stylers":[{"saturation":-100},{"visibility":"simplified"}]},{"featureType":"administrative.province","stylers":[{"visibility":"off"}]},{"featureType":"water","elementType":"labels","stylers":[{"visibility":"on"},{"lightness":-25},{"saturation":-100}]},{"featureType":"water","elementType":"geometry","stylers":[{"hue":"#ffff00"},{"lightness":-25},{"saturation":-97}]}]
        };

        map = new google.maps.Map(document.getElementById('map-canvas'),mapOptions);

        center_marker = new google.maps.Marker({
            position: center,
            title: "center"
        });

        // To add the marker to the map, call setMap();
        center_marker.setMap(map);
    };

    this.moveTo = function(point){
        center_marker.setMap(null);
        center_marker = new google.maps.Marker({
            position: point,
            title: "center"
        });
        center_marker.setMap(map);
        map.setCenter(point);
    };

    this.drawPoint = function(point){
        var populationOptions = {
          strokeColor: '#FF0000',
          strokeOpacity: 0.6,
          strokeWeight: 1,
          fillColor: '#FF0000',
          fillOpacity: 0.35,
          map: map,
          center: point,
          radius: Math.sqrt(Math.pow(10,point.mag)) * 200,
        };
        cityCircle = new google.maps.Circle(populationOptions);
    };
});

interanaApp.controller('MainControl', function($scope, $http, disCalculator, geoGetter, googleMapService) {
    var d = new Date();
    d.setDate(d.getDate()-7);
    d.setHours(0,0,0,0);
    $scope.search_form = {
        source: "earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson",
        center: "Sunnyvale, CA 94085",
        radis: 100,
        start_date: d,
    };
    $scope.cached_earthquake_data = null;
    $scope.records = [];
    $scope.predicate = "distance";

    $scope.$watch("search_form.source", function(){
        $scope.cached_earthquake_data = null;
    });

    $scope.fetchData = function(){
        if(!$scope.search_form.source){
            alert("Source of earthquake data is required!");
            return;
        }
        var geoPromise = geoGetter.getGeo($scope.search_form.center);
        geoPromise.
            success(function(geo_data){
                if(geo_data.length === 0){
                    alert("Not a valid address.");
                    return;
                }
                if($scope.cached_earthquake_data === null){
                    $http.get("http://wuhulu.net:1337/" + $scope.search_form.source).
                        success(function(data) {
                            $scope.cached_earthquake_data = data;
                            $scope.processData(
                                geo_data.results[0].geometry,
                                $scope.cached_earthquake_data.features || []
                            );
                         }).
                        error(function(data, status, headers, config) {
                            alert("Failed to download source of earthquake data!");
                        });
                }else{
                    $scope.processData(
                        geo_data.results[0].geometry,
                        $scope.cached_earthquake_data.features || []
                    );
                }
            }).
            error(function(){
                alert("Fail to retrieve geo info by address.");
            });
    };

    $scope.goto = function(r){
        var point = {
            lat: r.geometry.coordinates[1],
            lng: r.geometry.coordinates[0],
        };
        googleMapService.moveTo(point);
    };

    $scope.processData = function(center, records){
        var rows = records.length;
        var center_geo = center.location;
        var time = $scope.search_form.start_date;
        googleMapService.initialize(center_geo);
        $scope.records = [];
        for(var i=0; i < rows; i++){
            var r = records[i];
            var point = {
                lat: r.geometry.coordinates[1],
                lng: r.geometry.coordinates[0],
                mag: r.properties.mag,
            };
            var distance = disCalculator.cal(center_geo, point);
            if(distance < $scope.search_form.radis && r.properties.time > time){
                r.distance = distance;
                googleMapService.drawPoint(point);
                $scope.records.push(r);
            }
        }
    };

    $scope.fetchData();
});
