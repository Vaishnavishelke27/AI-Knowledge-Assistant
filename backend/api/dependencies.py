from collections.abc import Callable

from fastapi import Depends, HTTPException, status

from backend.core.auth import get_current_user
from backend.models.user import User, UserRole


def role_checker(*allowed_roles: UserRole | str) -> Callable[..., User]:
    normalized_roles = {
        role if isinstance(role, UserRole) else UserRole(role) for role in allowed_roles
    }

    def check_role(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in normalized_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return check_role

