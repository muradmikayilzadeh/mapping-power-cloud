import React, { useState } from 'react';
import styles from './style.module.css';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();

        // Disable the submit button during the request
        setIsSubmitting(true);

        // Prepare the data to be sent in the request body
        const data = {
            email,
            password,
        };

        try {
            const response = await fetch("https://us-central1-qroovy-a9b3a.cloudfunctions.net/app/login", {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (response.ok) {
                // console log response data
                const responseData = await response.json();
                if (responseData.is_admin != "") {
                    console.log('Success');
                    // redirect to dashboard with data from response
                    localStorage.setItem('listing_id', responseData.is_admin);
                    window.location.href = '/dashboard';
                } else {
                    setErrorMessage('E-poçt ünvanı və ya şifrə yanlışdır!');
                }
            } else {
                setErrorMessage('E-poçt ünvanı və ya şifrə yanlışdır!');
            }
        } catch (error) {
            console.error('An error occurred:', error);
            setErrorMessage('An error occurred during login.');
        } finally {
            // Re-enable the submit button after the request is completed
            setIsSubmitting(false);
        }
    };

    return (
        <div className={styles.wrapper + " admin-shell"}>
            <div className={styles.coverPhotoContainer}></div>
            <div className={styles.loginContainer}>
                <form>
                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            type="email"
                            id="email"
                            autoFocus
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
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
                    <button type="submit" onClick={handleLogin} disabled={isSubmitting}>
                        {isSubmitting ? 'Loading...' : 'Login'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;
