import './App.css';
import { useEffect } from 'react';
import { bitable, UIBuilder } from "@lark-base-open/js-sdk";
import callback from './runUIBuilder';
import { useTranslation } from 'react-i18next';


export default function App() {
  const { t } = useTranslation();
  useEffect(() => {
    const uiBuilder = new UIBuilder(document.querySelector('#container') as HTMLElement,
      { bitable, callback: (ui: any) => (callback(ui, t) as any) });
    return () => {
      uiBuilder.umount();
    }
  }, []);
  return (<div>
    <div id='container'></div>
  </div>
  );
}