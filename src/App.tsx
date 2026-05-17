import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import './amplify-config'; // load config
import { FileUpload } from './FileUpload';

function App() {
  return (
    <Authenticator hideSignUp={ true }>
      { ({ signOut, user }) => (
        <main style={ { padding: '2rem', fontFamily: 'sans-serif' } }>
          <header style={ { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }>
            <h1>Document to XML System</h1>
            <div style={ { display: 'flex', alignItems: 'center', gap: '1rem' } }>
              <span>Signed in as { user?.signInDetails?.loginId }</span>
              <button onClick={ signOut }>Sign Out</button>
            </div>
          </header>

          <FileUpload />
        </main>
      ) }
    </Authenticator>
  );
}

export default App;
