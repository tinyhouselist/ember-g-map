import Ember from 'ember';
import layout from '../templates/components/g-map';

const { isEmpty, isPresent, computed, observer, run } = Ember;

export default Ember.Component.extend({
  layout,
  classNames: ['g-map'],
  bannedOptions: Ember.A(['center', 'zoom']),
  idleListener: null,

  init() {
    this._super(...arguments);
    this.set('markers', Ember.A());
    this.set('polylines', Ember.A());
    if (isEmpty(this.get('options'))) {
      this.set('options', {});
    }
  },

  permittedOptions: computed('options', function() {
    const { options, bannedOptions } = this.getProperties(['options', 'bannedOptions']);
    const permittedOptions = {};
    for (let option in options) {
      if (options.hasOwnProperty(option) && !bannedOptions.includes(option)) {
        permittedOptions[option] = options[option];
      }
    }
    return permittedOptions;
  }),

  didInsertElement() {
    this._super(...arguments);
    run.scheduleOnce('afterRender', this, 'initializeMap');
  },

  initializeMap() {
    if (typeof FastBoot !== 'undefined') {
      return false;
    }

    let map = this.get('map');

    if (isEmpty(map)) {
      const canvas = this.$().find('.g-map-canvas').get(0);
      const options = this.get('permittedOptions');

      map = new google.maps.Map(canvas, options);
      const idleListener = google.maps.event.addListener(map, 'idle', () => {
        this.resizeMap();
      });

      this.setProperties({ map, idleListener });
    }

    this.setZoom();
    this.setCenter();

    if (this.get('shouldFit')) {
      this.fitToMarkers();
    }
  },

  resizeMap() {
    const map = this.get('map');
    const idleListener = this.get('idleListener');

    if (map) {
      google.maps.event.trigger(map, 'resize');
    }

    if (idleListener) {
      google.maps.event.removeListener(idleListener);
      this.set('idleListener', null);
    }
  },

  permittedOptionsChanged: observer('permittedOptions', function() {
    run.once(this, 'setOptions');
  }),

  setOptions() {
    const map = this.get('map');
    const options = this.get('permittedOptions');
    if (isPresent(map)) {
      map.setOptions(options);
    }
  },

  zoomChanged: observer('zoom', function() {
    run.once(this, 'setZoom');
  }),

  setZoom() {
    const map = this.get('map');
    const zoom = this.get('zoom');
    if (isPresent(map)) {
      map.setZoom(zoom);
    }
  },

  coordsChanged: observer('lat', 'lng', function() {
    run.once(this, 'setCenter');
  }),

  setCenter() {
    const map = this.get('map');
    const lat = this.get('lat');
    const lng = this.get('lng');

    if (isPresent(map)
      && isPresent(lat)
      && isPresent(lng)
      && (typeof FastBoot === 'undefined')) {
      const center = new google.maps.LatLng(lat, lng);
      map.setCenter(center);
    }
  },

  registerMarker(marker) {
    this.get('markers').addObject(marker);
  },

  unregisterMarker(marker) {
    this.get('markers').removeObject(marker);
  },

  registerPolyline(polyline) {
    this.get('polylines').addObject(polyline);
  },

  unregisterPolyline(polyline) {
    this.get('polylines').removeObject(polyline);
  },

  shouldFit: computed('markersFitMode', function() {
    return Ember.A(['init', 'live']).includes(this.get('markersFitMode'));
  }),

  markersChanged: observer('markers.@each.lat', 'markers.@each.lng', function() {
    if (this.get('markersFitMode') === 'live') {
      run.once(this, 'fitToMarkers');
    }
  }),

  fitToMarkers() {
    const markers = this.get('markers').filter((marker) => {
      return isPresent(marker.get('lat')) && isPresent(marker.get('lng'));
    });

    if (markers.length === 0
        || (typeof FastBoot !== 'undefined')) {
      return;
    }

    const map = this.get('map');
    const bounds = new google.maps.LatLngBounds();

    markers.forEach((marker) => bounds.extend(new google.maps.LatLng(marker.get('lat'), marker.get('lng'))));
    map.panToBounds(bounds);
    map.fitBounds(bounds);
  },

  groupMarkerClicked(marker, group) {
    let markers = this.get('markers').without(marker).filterBy('group', group);
    markers.forEach((marker) => marker.closeInfowindow());
  }
});
