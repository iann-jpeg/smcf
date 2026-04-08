import { createBrowserRouter } from 'react-router-dom';
import SACCOShareholdersModule from '../pages/SACCOShareholders';

export const saccoRoutes = [
  {
    path: '/sacco',
    element: <SACCOShareholdersModule />,
    children: []
  }
];

export default saccoRoutes;
