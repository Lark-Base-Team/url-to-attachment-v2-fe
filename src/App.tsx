import './App.css';
import { useEffect } from 'react';
import { bitable, UIBuilder } from "@base-open/web-api";
import callback from './runUIBuilder';
import { useTranslation } from 'react-i18next';


export default function App() {
    const { t } = useTranslation();
    useEffect(() => {
        UIBuilder.getInstance('#container', { bitable, callback: (ui) => callback(ui, t) });
    }, []);
  return (<div>
    <div id='container'></div>
  </div>
  );
}