import './amplify-config'; // load config
import { FileUpload } from './FileUpload';

function App() {
  return (
    <main style={ { padding: '2rem', fontFamily: 'sans-serif' } }>
      <header style={ { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }>
        <h1>Document to XML System</h1>
        <div style={ { display: 'flex', alignItems: 'center', gap: '1rem' } }>
          <span>Signed in as Local Test User</span>
        </div>
      </header>

      <FileUpload />
    </main>
  );
}

export default App;
