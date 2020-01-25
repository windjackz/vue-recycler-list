import RecyclerList from './components/RecyclerList.vue';
import './utils/requestAnimationFramePolyfill';

if (typeof window !== 'undefined' && window.Vue) {
    window.Vue.component('RecyclerList', RecyclerList)
}

RecyclerList.install = function(Vue){
    Vue.component(RecyclerList.name, RecyclerList)
}

export default RecyclerList;