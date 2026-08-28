import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './style.module.css';
import { useAuth } from '../../../context/AuthContext';

const LoginPage = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setErrorMessage('');
        setIsSubmitting(true);

        try {
            await login(username, password);
            navigate('/dashboard');
        } catch (error) {
            setErrorMessage('Incorrect username or password.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={styles.wrapper + " admin-shell"}>
            <div className={styles.coverPhotoContainer}></div>
            <div className={styles.loginContainer}>
                <form onSubmit={handleLogin}>
                    <div className="form-group">
                        <label htmlFor="username">Username</label>
                        <input
                            type="text"
                            id="username"
                            autoFocus
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    {errorMessage && <div className={styles.errorMessage}>{errorMessage}</div>}
                    <button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? 'Loading...' : 'Login'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;
