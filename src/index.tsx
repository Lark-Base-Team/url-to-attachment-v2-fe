import React , {useState, useEffect} from 'react'
import ReactDOM from 'react-dom/client'
import './App.css';
import 'normalize.css';
import App from './App';
import { initI18n } from './i18n'
import { bitable } from '@base-open/web-api';
import { useTranslation } from 'react-i18next';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<React.StrictMode><LoadApp/></React.StrictMode>)



function LoadApp() {
  
  const [load, setLoad] = useState(false);
  const [loadErr, setLoadErr] = useState<any>(null)
  useEffect(() => {
    const timer = setTimeout(() => {
      initI18n('en');
      setTimeout(()=>{
        setLoadErr(<LoadErr/>)
        
      },1000)
    }, 5000)
    bitable.bridge.getLanguage().then((lang) => {
      clearTimeout(timer)
      initI18n(lang as any);
      setLoad(true);
    });
    return () => clearTimeout(timer)
  }, [])

  if (load) {
    return <App />
  }

  return loadErr
}

function LoadErr() {
  const {t} = useTranslation();
  return <div>
            {t('load_error.1')}
            <a target='_blank' href='https://bytedance.feishu.cn/docx/HazFdSHH9ofRGKx8424cwzLlnZc'>{t('load.guide')}</a>
          </div>
        
}

