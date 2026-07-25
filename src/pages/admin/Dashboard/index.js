// Dashboard.js

import React from 'react';
import styles from './style.module.css';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHome, faMap, faBook, faCog, faTimeline } from '@fortawesome/free-solid-svg-icons';

const Dashboard = () => {
  // Sample data for the number of maps and narratives
  const numMaps = 10; // Placeholder value, replace it with actual data
  const numNarratives = 5; // Placeholder value, replace it with actual data
  const navigate = useNavigate();

  return (
    <div className={styles.dashboard + " admin-shell"}>
      <div className={styles.sidebar}>
        <ul className={styles.sidebarMenu}>
          <li onClick={() => navigate('/dashboard')}><FontAwesomeIcon icon={faHome} /><span>Home</span></li>
          <li onClick={() => navigate('/eras')} ><FontAwesomeIcon icon={faTimeline} /><span>Eras</span></li>
          <li onClick={() => navigate('/maps')}><FontAwesomeIcon icon={faMap} /><span>Maps</span></li>
          <li onClick={() => navigate('/narratives')}><FontAwesomeIcon icon={faBook} /><span>Narratives</span></li>
          <li onClick={() => navigate('/settings')}><FontAwesomeIcon icon={faCog} /><span>Settings</span></li>
        </ul>
      </div>
      <div className={styles.content}>
        <h1>Welcome to the Home Page</h1>
        {/* Cards for displaying number of maps and narratives */}
        <div className={styles.cards}>
          <div className={styles.card}>
            <FontAwesomeIcon icon={faMap} />
            <span>Maps</span>
            <span>{numMaps}</span>
          </div>
          <div className={styles.card}>
            <FontAwesomeIcon icon={faBook} />
            <span>Narratives</span>
            <span>{numNarratives}</span>
          </div>
        </div>
        {/* Placeholder for graphs */}
        <div className={styles.graphs}>
          <div className={styles.graphPlaceholder}>Graph 1 - Visitors Over Time</div>
          <div className={styles.graphPlaceholder}>Graph 2 - Popular Pages</div>
          <div className={styles.graphPlaceholder}>Graph 3 - Demographics</div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
