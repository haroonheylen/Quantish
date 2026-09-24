import { createApp } from 'vue';
import App from './App.vue';
import router from './router';

// Only the weights actually used, to keep the bundle small.
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import './assets/main.css';

createApp(App).use(router).mount('#app');